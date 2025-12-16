import "server-only";
import { TotalumApiSdk } from "totalum-api-sdk";
import type { Adapter } from "better-auth";
import { createAdapterFactory } from "better-auth/adapters";

// ==================== Type Definitions ====================

interface Where {
  operator?:
    | "eq"
    | "ne"
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "in"
    | "not_in"
    | "contains"
    | "starts_with"
    | "ends_with";
  value: string | number | boolean | string[] | number[] | Date | null;
  field: string;
  connector?: "AND" | "OR";
}

interface TotalumAdapterConfig {
  /**
   * Enable debug logs for the adapter
   * @default false
   */
  debugLogs?: boolean;
  /**
   * Prefix for Totalum collections (usually "data_")
   * @default "data_"
   */
  collectionPrefix?: string;
}

// ==================== Utility Functions ====================

/**
 * Convert camelCase field names to snake_case for Totalum
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Convert snake_case field names to camelCase for Better Auth
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if a field is a Totalum auto-generated field that should stay in camelCase
 */
function isTotalumAutoField(field: string): boolean {
  return field === '_id' || field === 'id' || field === 'createdAt' || field === 'updatedAt' || field === 'createdBy';
}

/**
 * Convert an object's keys from camelCase to snake_case
 * IMPORTANT: Totalum auto-fields (_id, createdAt, updatedAt, createdBy) stay in camelCase
 * Custom fields get converted to snake_case
 * IMPORTANT: Booleans are converted to "si"/"no" strings for Totalum options fields
 */
function objectToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip auto-generated Totalum fields - they stay in camelCase
    if (isTotalumAutoField(key)) {
      result[key] = value;
      continue;
    }

    const snakeKey = key === "id" ? "_id" : toSnakeCase(key);

    if (value && typeof value === "object" && !(value instanceof Date)) {
      if (Array.isArray(value)) {
        result[snakeKey] = value.map((item) =>
          typeof item === "object" && item !== null
            ? objectToSnakeCase(item)
            : item
        );
      } else {
        result[snakeKey] = objectToSnakeCase(value);
      }
    } else if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else if (typeof value === "boolean") {
      // Convert booleans to "si"/"no" for Totalum options fields
      result[snakeKey] = value ? "si" : "no";
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Convert an object's keys from snake_case to camelCase
 * IMPORTANT: Totalum auto-fields (_id, createdAt, updatedAt, createdBy) stay as-is
 * Custom fields get converted from snake_case to camelCase
 * IMPORTANT: "si"/"no" strings are converted to booleans for fields ending in _verified
 */
function objectToCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Keep Totalum auto-fields as-is, but map _id to id for Better Auth compatibility
    if (key === "_id") {
      result["id"] = value;
      continue;
    }
    if (isTotalumAutoField(key)) {
      result[key] = value;
      continue;
    }

    const camelKey = toCamelCase(key);

    if (value && typeof value === "object" && !(value instanceof Date)) {
      if (Array.isArray(value)) {
        result[camelKey] = value.map((item) =>
          typeof item === "object" && item !== null
            ? objectToCamelCase(item)
            : item
        );
      } else {
        result[camelKey] = objectToCamelCase(value);
      }
    } else if (typeof value === "string" && isISODate(value)) {
      result[camelKey] = new Date(value);
    } else if (typeof value === "string" && (value === "si" || value === "no") && (key.includes("verified") || key.includes("_verified"))) {
      // Convert "si"/"no" back to booleans for verified fields
      result[camelKey] = value === "si";
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Check if a string is an ISO date string
 */
function isISODate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str);
}

/**
 * Convert Better Auth where clauses to Totalum filter format
 */
function convertWhereToTotalumFilter(where: Where[]): any {
  if (!where || where.length === 0) return {};

  const andFilters: any[] = [];
  const orFilters: any[] = [];

  for (const clause of where) {
    // Handle field name conversion: id -> _id, auto-fields stay as-is, others to snake_case
    let field: string;
    if (clause.field === "id") {
      field = "_id";
    } else if (isTotalumAutoField(clause.field)) {
      field = clause.field; // Keep auto-fields as-is
    } else {
      field = toSnakeCase(clause.field); // Convert custom fields to snake_case
    }

    const value =
      clause.value instanceof Date
        ? clause.value.toISOString()
        : clause.value;

    let filterClause: any;

    switch (clause.operator) {
      case "eq":
      case undefined:
        filterClause = { [field]: value };
        break;
      case "ne":
        filterClause = { [field]: { ne: value } };
        break;
      // Note: Totalum only supports gte/lte, not strict gt/lt
      // So we map lt -> lte and gt -> gte (best approximation)
      case "lt":
        filterClause = { [field]: { lte: value } };
        break;
      case "lte":
        filterClause = { [field]: { lte: value } };
        break;
      case "gt":
        filterClause = { [field]: { gte: value } };
        break;
      case "gte":
        filterClause = { [field]: { gte: value } };
        break;
      // Note: Totalum doesn't support $in/$nin operators
      // We need to use OR logic for "in" and combine with ne for "not_in"
      case "in":
        if (Array.isArray(value) && value.length > 0) {
          // Create OR filter with all possible values
          filterClause = {
            or: value.map((v: any) => ({ [field]: v })),
          };
        } else {
          // Empty array or invalid value - no match
          filterClause = { [field]: null };
        }
        break;
      case "not_in":
        if (Array.isArray(value) && value.length > 0) {
          // For not_in, we need multiple ne conditions (AND logic)
          // This will be handled by adding multiple filter clauses
          // We'll mark this with a special flag
          filterClause = {
            _multiple_ne: value.map((v: any) => ({ [field]: { ne: v } })),
          };
        } else {
          // Empty array - match everything (no exclusions)
          filterClause = {}; // No filter
        }
        break;
      // Note: Totalum doesn't have native contains/starts_with/ends_with
      // We use regex patterns to emulate these operators
      case "contains":
        filterClause = {
          [field]: { regex: String(value), options: "i" },
        };
        break;
      case "starts_with":
        filterClause = {
          [field]: { regex: `^${String(value)}`, options: "i" },
        };
        break;
      case "ends_with":
        filterClause = {
          [field]: { regex: `${String(value)}$`, options: "i" },
        };
        break;
      default:
        filterClause = { [field]: value };
    }

    // Handle special case for not_in (multiple ne conditions)
    if (filterClause._multiple_ne) {
      andFilters.push(...filterClause._multiple_ne);
    } else if (clause.connector === "OR") {
      orFilters.push(filterClause);
    } else {
      andFilters.push(filterClause);
    }
  }

  const filter: any[] = [];

  if (orFilters.length > 0) {
    filter.push({ or: orFilters });
  }

  filter.push(...andFilters);

  return { filter };
}

/**
 * Unwrap Totalum SDK response
 * Note: Response structure is result.data (not result.data.data)
 */
function unwrapTotalumResponse<T>(response: any): T | null {
  return response?.data ?? null;
}

// ==================== Totalum Adapter Implementation ====================

export function totalumAdapter(
  client: TotalumApiSdk,
  config: TotalumAdapterConfig = {}
) {
  const { debugLogs = false } = config;

  const log = (...args: any[]) => {
    if (debugLogs) {
      // SUPER IMPORTANT: THIS LINE IS COMMENTED BECAUSE IT GENERATES A LOT OF LOGS AND CONTAMINATES THE OUTPUT. ONLY UNCOMMENT IF SOMETHING ON AUTH IS NOT WORKING AND YOU NEED TO DEBUG IT.
      //console.log("[Totalum Adapter]", ...args);
    }
  };

  /**
   * Get the Totalum table name from Better Auth model name
   */
  const getTableName = (model: string): string => {
    // Convert model name to snake_case
    const tableName = toSnakeCase(model);
    log(`Model "${model}" -> Table "${tableName}"`);
    return tableName;
  };

  return createAdapterFactory({
    config: {
      adapterId: "totalum",
      supportsJSON: false,
      supportsDates: true,
      supportsBooleans: false,
      supportsNumericIds: false,
      disableIdGeneration: true,
    },
    adapter: () => {
      return {
        id: "totalum",

        /**
         * Create a new record
         */
        async create<T extends Record<string, any>, R = T>(data: {
          model: string;
          data: Omit<T, "id">;
          select?: string[];
          forceAllowId?: boolean;
        }): Promise<R> {
          log("CREATE", data);
          const tableName = getTableName(data.model);
          const snakeCaseData = objectToSnakeCase(data.data);

          // Remove _id if present (Totalum auto-generates)
          if (!data.forceAllowId) {
            delete snakeCaseData._id;
          }

          const response = await client.crud.createRecord(
            tableName,
            snakeCaseData
          );

          // createRecord now returns the full created record
          const record = unwrapTotalumResponse(response);

          if (!record) {
            throw new Error(`Failed to create ${data.model}`);
          }

          const result = objectToCamelCase(record);
          log("CREATE result:", result);
          return result as R;
        },

        /**
         * Find a single record
         */
        async findOne<T>(data: {
          model: string;
          where: Where[];
          select?: string[];
        }): Promise<T | null> {
          log("FIND_ONE", data);
          const tableName = getTableName(data.model);
          const filterQuery = convertWhereToTotalumFilter(data.where);

          const response = await client.crud.getRecords(tableName, {
            ...filterQuery,
            pagination: { limit: 1, page: 0 },
          });

          const items = unwrapTotalumResponse<any[]>(response) || [];
          const record = items[0] || null;

          if (!record) {
            log("FIND_ONE: Not found");
            return null;
          }

          const result = objectToCamelCase(record);
          log("FIND_ONE result:", result);
          return result as T;
        },

        /**
         * Find multiple records
         */
        async findMany<T>(data: {
          model: string;
          where?: Where[];
          limit?: number;
          sortBy?: {
            field: string;
            direction: "asc" | "desc";
          };
          offset?: number;
        }): Promise<T[]> {
          log("FIND_MANY", data);
          const tableName = getTableName(data.model);
          const filterQuery = convertWhereToTotalumFilter(data.where || []);

          const query: any = {
            ...filterQuery,
            pagination: {
              limit: data.limit || 50,
              page: data.offset ? Math.floor(data.offset / (data.limit || 50)) : 0,
            },
          };

          if (data.sortBy) {
            const sortField =
              data.sortBy.field === "id" ? "_id" : toSnakeCase(data.sortBy.field);
            query.sort = {
              [sortField]: data.sortBy.direction === "asc" ? 1 : -1,
            };
          }

          const response = await client.crud.getRecords(tableName, query);
          const items = unwrapTotalumResponse<any[]>(response) || [];

          const result = items.map((item) => objectToCamelCase(item));
          log("FIND_MANY result count:", result.length);
          return result as T[];
        },

        /**
         * Count records
         */
        async count(data) {
          log("COUNT", data);
          const tableName = getTableName(data.model);
          const filterQuery = convertWhereToTotalumFilter(data.where || []);

          const response = await client.crud.getRecords(tableName, {
            ...filterQuery,
            pagination: { limit: 1000, page: 0 }, // Large limit to get count
          });

          const items = unwrapTotalumResponse<any[]>(response) || [];
          const count = items.length;

          log("COUNT result:", count);
          return count;
        },

        /**
         * Update a single record
         */
        async update<T>(data: {
          model: string;
          where: Where[];
          update: Record<string, any>;
        }): Promise<T | null> {
          log("UPDATE", data);
          const tableName = getTableName(data.model);

          // Find the record first
          const filterQuery = convertWhereToTotalumFilter(data.where);
          const findResponse = await client.crud.getRecords(tableName, {
            ...filterQuery,
            pagination: { limit: 1, page: 0 },
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];
          const record = items[0];

          if (!record) {
            log("UPDATE: Record not found");
            return null;
          }

          const recordId = record._id;
          const snakeCaseUpdate = objectToSnakeCase(data.update);
          delete snakeCaseUpdate._id; // Don't update ID

          // editRecordById now returns the full updated record
          const updateResponse = await client.crud.editRecordById(tableName, recordId, snakeCaseUpdate);
          const updatedRecord = unwrapTotalumResponse(updateResponse);

          if (!updatedRecord) {
            log("UPDATE: Failed to update record");
            return null;
          }

          const result = objectToCamelCase(updatedRecord);
          log("UPDATE result:", result);
          return result as T;
        },

        /**
         * Update multiple records
         */
        async updateMany(data) {
          log("UPDATE_MANY", data);
          const tableName = getTableName(data.model);
          const filterQuery = convertWhereToTotalumFilter(data.where);

          // Find all matching records
          const findResponse = await client.crud.getRecords(tableName, {
            ...filterQuery,
            pagination: { limit: 1000, page: 0 },
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];
          const snakeCaseUpdate = objectToSnakeCase(data.update);
          delete snakeCaseUpdate._id;

          // Update each record
          let updateCount = 0;
          for (const item of items) {
            try {
              await client.crud.editRecordById(tableName, item._id, snakeCaseUpdate);
              updateCount++;
            } catch (error) {
              log("UPDATE_MANY error for item", item._id, error);
            }
          }

          log("UPDATE_MANY result count:", updateCount);
          return updateCount;
        },

        /**
         * Delete a single record
         */
        async delete(data) {
          log("DELETE", data);
          const tableName = getTableName(data.model);
          const filterQuery = convertWhereToTotalumFilter(data.where);

          // Find the record first
          const findResponse = await client.crud.getRecords(tableName, {
            ...filterQuery,
            pagination: { limit: 1, page: 0 },
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];
          const record = items[0];

          if (!record) {
            log("DELETE: Record not found");
            return;
          }

          await client.crud.deleteRecordById(tableName, record._id);
          log("DELETE: Success");
        },

        /**
         * Delete multiple records
         */
        async deleteMany(data) {
          log("DELETE_MANY", data);
          const tableName = getTableName(data.model);
          const filterQuery = convertWhereToTotalumFilter(data.where);

          // Find all matching records
          const findResponse = await client.crud.getRecords(tableName, {
            ...filterQuery,
            pagination: { limit: 1000, page: 0 },
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];

          // Delete each record
          let deleteCount = 0;
          for (const item of items) {
            try {
              await client.crud.deleteRecordById(tableName, item._id);
              deleteCount++;
            } catch (error) {
              log("DELETE_MANY error for item", item._id, error);
            }
          }

          log("DELETE_MANY result count:", deleteCount);
          return deleteCount;
        },

        /**
         * Transaction support (fallback to sequential operations)
         * Note: Totalum doesn't support real transactions, so we execute operations sequentially
         */
        async transaction(callback) {
          log("TRANSACTION: Starting (sequential fallback)");

          try {
            // Pass the same adapter instance for operations within the "transaction"
            const result = await callback({
              id: this.id,
              create: this.create,
              findOne: this.findOne,
              findMany: this.findMany,
              count: this.count,
              update: this.update,
              updateMany: this.updateMany,
              delete: this.delete,
              deleteMany: this.deleteMany,
            });

            log("TRANSACTION: Completed successfully");
            return result;
          } catch (error) {
            log("TRANSACTION: Failed", error);
            throw error;
          }
        },
      } satisfies Adapter;
    },
  });
}

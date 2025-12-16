## advanced-queries

### Filter using your custom mongoDb aggregation query

**Use Case:**

If you need to do a custom query that is not supported by the previous methods, you can use this method to do a custom mongoDb aggregation query.
This method is very powerful, you can do any query you want, but you need to know how to write mongoDb aggregation queries.
See the documentation of mongoDb aggregation queries here: https://docs.mongodb.com/manual/aggregation/.

Aggregation queries are very powerful for do custom complex queries like joins, group by, union, etc. (the same power as sql queries)

**Note:**

In Totalum mongoDb Database the tables and items has the following structure:

```json

"_id": 2342342342342,
// here goes all the properties of the item with the custom names and values that you have defined
"property_name": "value",
"property_name2": "value2",
"property_name2": "value2"
//etc...
"createdAt": "2021-01-01T00:00:00.000Z",
"updatedAt": "2021-01-01T00:00:00.000Z"

```

#### Each table in Totalum is a mongoDb collection (adding data_ prefix), and each record in the table is a document in the collection.
#### So for example, if you have a table named `product`, in the mongoDb database the collection will be named `data_product`.

#### Important Information:

- **For match by Id (ObjectId)**, as the mongoDb query is a string, you need to put: ObjectId('your_id') in the query string, instead of just 'your_id'.
- **For match by date**, you need to put the date in the format: Date('your_date') in the query string, instead of just 'your_date'. Ideally provide a iso date string like '2021-01-01T00:00:00.000Z' for avoid time zone issues.

```javascript

// filter results from your_element_table_name applying a filter query (a custom mongodb aggregation query)
const customMongoDbAggregationQueryInString = `

  your custom mongo aggregation query in string, for more info:
    https://docs.mongodb.com/manual/aggregation/

    or ask to chatgpt, he is very good writing mongo aggregation queries ;)

`;

const result = await totalumSdk.filter.runCustomMongoAggregationQuery(tableElementName, customMongoDbAggregationQueryInString);

```

**example**

Imagine you have a table named `product`, with properties `name` (text), `price` (number), `provider` (many to one relation with relationship with the table `provider`).

And you want to get all the products that have a price greater than 10, and that have a provider that have the name 'John', and also return all products with the full provider autofill, so you can do this:

```javascript

const tableElementName = 'product';
const customMongoDbAggregationQueryInString = `
    [
        {
            $match: {
                "price": {$gte: 10}
            }
        },
          // Join the data_product with data_provider using provider as the linking _id
        {
            $lookup: {
                from: "data_provider", // we add the prefix "data_" to the table name
                localField: "provider",
                foreignField: "_id",
                as: "provider"  // Now storing the result directly in the "provider" field
            }
        },
        {
            $match: {
                "provider.name": "John"
            }
        },
        // Simplify the provider to be an object instead of an array
        {
            $addFields: {
              "provider": {
                $arrayElemAt: ["$provider", 0]
              }
            }
        }
    ]
`;

const result = await totalumSdk.filter.runCustomMongoAggregationQuery(tableElementName, customMongoDbAggregationQueryInString);
const items = result.data;

```


If a call returns a 400 suggesting a different name (e.g., "Do you mean: contactsubmission?"), convert your intended name to snake_case and retry (contact_submission), not a smashed string.

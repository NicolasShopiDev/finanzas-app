## get-data

When is possible to get data use getNestedData method to get nested data in one query. Search for getNestedData docs in this page.


### Get item by id

**Use Case:**

Get only one item by id from your element table

```javascript

// get item by id from your_element_table_name
const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table
let your_item_id = 'your_item_id'; // replace 'your_item_id' with the id of the item object
const result = await totalumSdk.crud.getRecordById(tableElementName, your_item_id);
const item = result.data;

/*
IMPORTANT: the result has this format:
{
    data: RecordType; // the record
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

```

### Get items

**Use Case:**

Get items from your element table without filters and pagination and sort (by default 50 items per page)

Warning: if have more than 50 items, you will need to use pagination to get all the item. (see Filter data using totalum section of this page)

```javascript

// get items from your_element_table_name (for default 50 items per page)
const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table
const result = await totalumSdk.crud.getRecords(tableElementName, {});
const items = result.data;

/*
IMPORTANT: the result has this format:
{
    metadata?: {
        count: number; // total number of records in the table for the given query
    },
    data: RecordType[]; // the records
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

```

### Get the historic updates of a record by its ID.

**Use Case:**

You can get all changes that have been made to a record.

```javascript

const result = await totalumSdk.crud.getHistoricRecordUpdatesById(yourRecordId); // replace yourRecordId with the id of the record

/*
IMPORTANT: the result has this format:
{
    metadata?: {
        count: number; // total number of records in the table for the given query
    },
    data: {
        objectId: string;
        typeId: string; //the table id
        updatesRecord: {
            timestamp: Date | string; //sometimes is string, sometimes is Date
            userId: string; //the internal admin backoffice user id that made the change
            changes: {
                old?: any; // a json with the old values of the changed properties
                new: any; // a json with the new values of the changed properties (may be incomplete, maybe only have the changed properties)
            }
        }[];
    }
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

const updates = result.data;

```

### Get nested items

Get multiple nested items in one query.
It works for `one to many`, `many to one` and `many to many` relationships. Remember that for `many to many` no set any junction table, just the table names, because totalum manages the junction tables under the hood.


**Use Case:**

Imagine you have 3 tables, `client`, `order` and `product`, and you want to get some clients with all orders and the products of the orders

```javascript

const nestedQuery: NestedQuery = {
    client: {
        order: {
            product: {}
        },
    }
}
//pd: client, order and product are the names of the tables, not the field names. But in the result, the nested data will have the field names, not the table names.

const result = await totalumSdk.crud.getNestedData(nestedQuery);

/*
IMPORTANT: the result has this format:
{
    data: RecordType; // see the next example for the structure of the nested data
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/


const clients = result.data;
/*
clients will have a structure like this:
[
    {
        _id: 'client_id_1',
        name: 'Client 1',
        orders: [
            {
                _id: 'order_id_1',
                date: '2023-01-01',
                products: [
                    {
                        _id: 'product_id_1',
                        name: 'Product 1'
                    },
                    {
                        _id: 'product_id_2',
                        name: 'Product 2'
                    }
                ]
            },
        ]
    },
    // more clients...
]

*/


```

For default, the nested query will return 100 for each table. If you want to get all the items, you will need to use pagination and do multiple queries.
In the next example, you will see how to use pagination to get items.

### Get nested items and filter

This is the same as the previous example, but now you want to filter the results

```javascript

// As before you have client, order, and product tables, but you now want to only get the client with name 'Jhon' and limit to 10 results

const nestedQuery: NestedQuery = {
    client: {
        tableFilter: {
            filter: [{
              name: 'Jhon'
            }],
            sort: {
              name: 1
            },
            pagination: {
              limit: 10,
              page: 0,
            }
        },
        order: {
            product: {}
        },
    }
}

//pd: client, order and product are the names of the tables, not the field names. But in the result, the nested data will have the field names, not the table names.


const result = await totalumSdk.crud.getNestedData(nestedQuery);

/*
IMPORTANT: the result has this format:
{
    data: RecordType; // see the last example for the structure of the nested data
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

const clients = result.data;


```

More information of how to use filters, sort, and pagination in the section [Filter data using totalum](/docs/api/howFilterWorks)


### get many to many references items

**Use Case:**

THIS ONLY WORKS FOR `MANY TO MANY` RELATIONSHIPS, IF YOU WANT TO GET `ONE TO MANY` or `MANY TO ONE`  REFERENCES ITEMS, USE THE METHOD `getItems` INSTEAD.

Get many to many references items from your element table without filters and pagination and sort (by default 50 items per page)

```javascript

const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table
let your_item_id = 'your_item_id'; // replace 'your_item_id' with the id of the item
const propertyName = 'your_property_name'; // replace 'your_property_name' with the name of the property that have a many to many relationship

// the query is optional, you can use it to filter and sort the results
const query = {
    filter: [
        {
            'your_property_name': 'value' // add your custom filters here
        },
    ],
    sort:{
        'your_property_name': 1 // 1 for asc, -1 for desc
    },
    pagination: {
        limit: 50,
        page: 0,
    }
};
const result = await totalumSdk.crud.getManyToManyReferencesRecords(tableElementName, your_item_id, propertyName, query);

/*
IMPORTANT: the result has this format:
{
    data: RecordType[];
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

```

### Filter data using totalum AND filter

**Use Case:**

Filter, sort and use pagination of items of a table. You can filter for all items properties and also for references (all conditions must be true)

```javascript

const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table

// get items from your_element_table_name (for default 50 items per page) applying a filter AND query (all conditions must be true)
const filter: FilterSearchQueryI = {
    filter: [
        {
            'your_property_name': 'value' // it matches the value exactly
        },
        {
            'your_other_property_name': {regex: 'your regex query', options: 'i'} // it matches a value using a regex query and options: i for case insensitive (ignore if it is uppercase or lowercase)
        },
        // PD: gte and lte operators are only allowed for properties of type date or number
        {
            'your_other_property_name': {gte: new Date('your date')} // it matches a value greater than or equal to the date
        },
        {
            'your_other_property_name': {lte: new Date('your date')} // it matches a value less than or equal to the date
        },
        {
            'your_other_property_name': {gte: 10} // it matches a value greater than or equal to 10
        },
        {
            'your_other_property_name': {lte: 100} // it matches a value less than or equal to 100
        }
    ],
    sort:{
        'your_property_name': 1 // 1 for asc, -1 for desc
    },
    pagination: {
        limit: 50,
        page: 0,
    }
};

const result = await totalumSdk.crud.getRecords<table_interface>(tableElementName, filter);

/*
IMPORTANT: the result has this format:
{
    data: RecordType[];
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

const items = result.data;

```

### Filter data using totalum OR filter

**Use Case:**

As the previous example, but now you want to Apply an OR filter instead of an AND filter. (at least one condition must be true)

```javascript

// get items from your_element_table_name (for default 50 items per page) applying a filter OR query (at least one condition must be true)
const filter: FilterSearchQueryI = {
    filter: [
        {
            or: [
                {
                    'your_property_name': 'value' // it matches the value exactly
                },
                {
                    'your_other_property_name': {regex: 'your regex query', options: 'i'} // it matches a value using a regex query and options: i for case insensitive (ignore if it is uppercase or lowercase)
                },
                {
                    'your_other_property_name': {gte: new Date('your date')} // it matches a value greater than or equal to the date
                },
            ]
        }
    ],
    sort: {
            'your_property_name': 1 // 1 for asc, -1 for desc
    },
    pagination: {
        limit: 50,
        page: 0,
    }
};

const result = await totalumSdk.crud.getRecords<table_interface>(tableElementName, filter);
const items = result.data;

```

### Filter data using totalum AND and OR filter

**Use Case:**

As the previous example, but now you want to Apply an AND and OR filter instead of an AND filter.

```javascript

// get items from your_element_table_name (for default 50 items per page) applying a filter OR and AND
const filter: FilterSearchQueryI = {
    filter: [
        {
            or: [
                {
                    'your_property_name_in_or': 'value' // it matches the value exactly
                },
                {
                    'your_other_property_name_in_or': {regex: 'your regex query', options: 'i'} // it matches a value using a regex query and options: i for case insensitive (ignore if it is uppercase or lowercase)
                },
            ],
        },
        {
            'your_other_property_name': 'value' // it matches the value exactly
        }

    ],
    sort: {
        'your_property_name': 1 // 1 for asc, -1 for desc
    },
    pagination: {
        limit: 50,
        page: 0,
    }
};

const result = await totalumSdk.crud.getRecords<table_interface>(tableElementName, filter);
const items = result.data;

```

### Get all references of an item (One to Many)

**Use Case:**

Get all the references of an item (one to many relationship)

```javascript

const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table
const query = {
    filter: [
        {
            'your_property_name': 'the_item_id'
        },
    ],
    // pagination and sort are optional
    sort:{
        'your_property_name': 1 // 1 for asc, -1 for desc
    },
    pagination: {
        limit: 50,
        page: 0,
    }
};

const result = await totalumSdk.crud.getRecords<table_interface>(tableElementName, query);

```

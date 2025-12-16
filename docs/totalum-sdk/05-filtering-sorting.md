## filter-pagination-data


Totalum filters structure are shared between all the filters. The structure is the following:

```json
{
    "filter": [
        {
            "property_name": "value" // search for specific string
        },
        // etc... Here is posible to add as many filters as needed
    ],
    "sort":{
        "property_name": 1 // 1 for asc, -1 for desc
    },
    "pagination": {
        "limit": 50, // the number of items per page
        "page": 0, // the page number starting from 0
    }
}
```

## How pagination works

The **pagination** property is used to limit the number of items that are returned in a single request. The **limit** property is used to specify the number of items that are returned in a single request. The **page** property is used to specify the page number that is returned in a single request. The page number starts from 0.

## How sorting works

The **sort** property is used to sort the items that are returned in a single request. The property_name property is used to specify the property that is used to sort the items. The value of the property_name property can be either 1 or -1. The value 1 is used to sort the items in ascending order. The value -1 is used to sort the items in descending order.

## How filter works

The **filter** property is used to filter the items that are returned in a single request. The property_name property is used to specify the property that is used to filter the items. The value property is used to specify the value that is used to filter the items. The value property can be a string, number, or boolean.

### Filter by string

We can filter by string using the following structure:

```json
{
    "filter": [
        {
            "property_name": "value" // search for specific string
        }
    ]
}
```

#### Filter by partial string

We can filter by partial string using the following structure:

```json
{
    "filter": [
        {
            "property_name": {
                "regex": "value", // search for partial string
                "options": "i" // case insensitive
            }
        }
    ]
}
```


### Filter by number

We can filter by number using the following structure:

```json
{
    "filter": [
        {
            "property_name": 1 // search for specific number
        }
    ]
}
```

#### Filter by number range

We can filter by range using the following structure:

```json
{
    "filter": [
        {
            "property_name": {
                "gte": 1, // greater than or equal to
                "lte": 10 // less than or equal to
            }
        }
    ]
}
```

### Filter by date

We can filter by date using the following structure:

```json
{
    "filter": [
        {
            "property_name": "2022-01-01T00:00:00.000Z" // search for specific date
        }
    ]
}
```

#### Filter by date range

We can filter by date range using the following structure:

```json
{
    "filter": [
        {
            "property_name": {
                "gte": "2024-01-01T00:00:00.000Z", // greater than or equal to
                "lte": "2024-01-10T00:00:00.000Z" // less than or equal to
            }
        }
    ]
}
```

### Filter by not equal to

We can filter by **not equal to** using the following structure:

```json
{
    "filter": [
        {
            "property_name": {
                "ne": "value" // not equal to
            }
        }
    ]
}
```

### Filter by a table relation

#### Get all references of an item table (One to Many)

**Use Case:**

Imagine you have 2 tables, `client` and `order`. Each client can have multiple orders. You want to get all the orders of a specific client.

```json

    "filter": [
        {
            "client": "the_item_id"
        },
    ],

```

As the client can have multiple orders, you will need to apply the filter to the `order` table.


### Filter multiple properties at the same time (AND condition)

That means that the filter will return only the items that match all the properties.

We can filter multiple properties at the same time using the following structure:

```json
{
    "filter": [
        {
            "property_name1": "value" // search for specific string
        },
        {
            "property_name2": 1 // search for specific number
        },
        {
            "property_name3": "2022-01-01T00:00:00.000Z" // search for specific date
        },
        {
            "property_name4": {
                "gte": 1, // greater than or equal to
                "lte": 10 // less than or equal to
            }
        },
        {
            "property_name5": {
                "regex": "value", // search for partial string
                "options": "i" // case insensitive
            }
        },
        {
            "property_name6": {
                "ne": "value" // not equal to
            }
        }
    ]
}
```

### Filter multiple properties at the same time (OR condition)

That means that the filter will return the items that match at least one of the properties.

We can filter multiple properties at the same time using the following structure:

```json
{
    "filter": [
        {
            "or": [
                {
                    "property_name1": "value" // search for specific string
                },
                {
                    "property_name2": 1 // search for specific number
                },
                {
                    "property_name3": "2022-01-01T00:00:00.000Z" // search for specific date
                },
                {
                    "property_name4": {
                        "gte": 1, // greater than or equal to
                        "lte": 10 // less than or equal to
                    }
                },
                {
                    "property_name5": {
                        "regex": "value", // search for partial string
                        "options": "i" // case insensitive
                    }
                },
                {
                    "property_name6": {
                        "ne": "value" // not equal to
                    }
                }
            ]
        }
    ]
}
```


### Filter multiple properties at the same time (AND and OR condition)

That means that the filter will return the items that match all the properties and at least one of the properties.


We can filter multiple properties at the same time using the following structure:

```json
{
    "filter": [
        {

            "or": [
                {
                    "property_name1": "some string"
                },
                {
                    "property_name2": 1 // search for specific number
                }
            ]
        },
        {
            "property_name3": "value"
        }
    ]
}
```

This filter will return the items that match the property_name3 and at least one of the properties in the or array.

---
name: totalum-sdk
description: TotalumSDK for database CRUD operations, filtering, pagination, and data queries. Use when reading, creating, updating, or deleting database records via the SDK. Also covers nested queries, relationships (one-to-many, many-to-many), file uploads, PDF generation, ChatGPT/AI integration, sending emails, and document scanning with AI.
---
# Totalum SDK Documentation Index

This documentation is split into modular files for efficient context usage. Load only what you need based on your task.

## 📖 Documentation Files

### [00-overview.md](./00-overview.md)
**Always start here!** Contains:
- SUPER IMPORTANT NOTES
- Hard rules (server-only, no secrets in client)
- API route pattern with error handling
- End-to-end workflow
- Snake_case naming conventions

### [01-getting-data.md](./01-getting-data.md)
**Use when:** Reading/fetching data from database

Contains:
- Get item by ID (`getRecordById`)
- Get items list (`getRecords`)
- Get historic updates
- Get nested items (with relations)
- Get many-to-many references
- Filter data (AND, OR, AND+OR)
- Get one-to-many references

### [02-creating-data.md](./02-creating-data.md)
**Use when:** Creating new records

Contains:
- Create item (`createRecord`)
- Create with many-to-many relationships
- Examples with client/product tables

### [03-updating-data.md](./03-updating-data.md)
**Use when:** Updating existing records

Contains:
- Edit item by ID (`editRecordById`)
- Add/edit one-to-many references
- Add/edit many-to-many references

### [04-deleting-data.md](./04-deleting-data.md)
**Use when:** Deleting records or relationships

Contains:
- Delete item by ID (`deleteRecordById`)
- Delete one-to-many reference
- Delete many-to-many reference (`dropManyToManyReferenceRecord`)

### [05-filtering-sorting.md](./05-filtering-sorting.md)
**Use when:** Implementing search, filters, pagination, or sorting

Contains:
- Filter structure overview
- How pagination works
- How sorting works
- Filter by string (exact, regex, partial)
- Filter by number (exact, range)
- Filter by date (exact, range)
- Filter by not equal to
- Filter by table relations
- Multiple filters (AND, OR, AND+OR)

### [06-file-uploads.md](./06-file-uploads.md)
**Use when:** Handling file uploads

Contains:
- Get file from input (Frontend)
- Get file from storage (Backend)
- Get file from remote URL (Backend)
- Get file from base64 string
- Upload file to Totalum (`uploadFile`)

### [07-advanced-queries.md](./07-advanced-queries.md)
**Use when:** Need complex queries (joins, aggregations, group by)

Contains:
- Custom MongoDB aggregation queries
- Table structure in MongoDB (data_ prefix)
- ObjectId and Date handling
- Example with $lookup, $match, $addFields

### [08-generate-custom-pdfs.md](./08-generate-custom-pdfs.md)
**Use when:** Generating PDF documents

Contains:
- Generate PDF from HTML (`createPdfFromHtml`)
- Link generated PDFs to records
- Handlebars template examples
- PDF generation best practices

### [09-use-openai-chatgpt-api.md](./09-use-openai-chatgpt-api.md)
**Use when:** Using AI/ChatGPT functionality

Contains:
- Create chat completions (`createChatCompletion`)
- Important model selection (gpt-4.1-mini, gpt-4.1-2025-04-14)
- Multi-turn conversations
- Generate content and save to database
- Note about using 'ai' package for heavy usage or other LLMs

### [10-send-emails.md](./10-send-emails.md)
**Use when:** Sending emails programmatically

Contains:
- Send basic emails (`sendEmail`)
- Send with attachments, CC, BCC, reply-to
- Send with Totalum storage files
- Transactional emails
- Note about using third-party services (Resend) for custom domains

### [11-scan-images-and-pdfs.md](./11-scan-images-and-pdfs.md)
**Use when:** Extracting data from documents using AI

Contains:
- Scan structured data from images/PDFs (`scanDocument`)
- Extract specific fields using JSON Schema
- Model selection (scanum, scanum-pro, scanum-eye-pro)
- Scan documents with arrays of items
- Advanced scanning options

## 🎯 Quick Reference by Task

| I need to... | Load these files |
|--------------|------------------|
| Create an API to list items | `00-overview.md` + `01-getting-data.md` |
| Create an API with search | `00-overview.md` + `01-getting-data.md` + `05-filtering-sorting.md` |
| Create an API to add items | `00-overview.md` + `02-creating-data.md` |
| Create an API to update items | `00-overview.md` + `03-updating-data.md` |
| Create an API to delete items | `00-overview.md` + `04-deleting-data.md` |
| Handle file uploads | `00-overview.md` + `06-file-uploads.md` |
| Do complex queries (joins) | `00-overview.md` + `07-advanced-queries.md` |
| Create with relationships | `00-overview.md` + `02-creating-data.md` |
| Query with filters | `00-overview.md` + `01-getting-data.md` + `05-filtering-sorting.md` |
| Generate PDF documents | `00-overview.md` + `08-generate-custom-pdfs.md` |
| Use ChatGPT/AI features | `00-overview.md` + `09-use-openai-chatgpt-api.md` |
| Send emails | `00-overview.md` + `10-send-emails.md` |
| Scan/extract data from documents | `00-overview.md` + `11-scan-images-and-pdfs.md` |

## 💡 Best Practices

1. **Always load `00-overview.md` first** - Contains essential setup and patterns
2. **Load only what you need** - Reduces context usage significantly
3. **Check the Quick Reference** - Saves time finding the right files
4. **Follow snake_case** - All table and field names must use `snake_case`
5. **Server-side only** - Never use TotalumSDK on frontend/client components

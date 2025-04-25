# AI Ad Generator Function

This Supabase Edge Function allows users to generate product ads using OpenAI's image generation API (gpt-image-1) by providing multiple product images and a text prompt.

## Features

- Upload multiple product images for AI to reference
- Provide a text prompt to describe the desired ad style
- Generate AI-based ad variations with high-quality outputs
- Validate transactions through Paddle payment API
- Store both input and generated images in Supabase Storage
- Track generation requests and results in database

## Prerequisites

1. Supabase project with Edge Functions enabled
2. OpenAI API key with access to the `gpt-image-1` model
3. Paddle API key for transaction validation
4. Supabase Storage bucket for image storage

## Environment Variables

Set the following environment variables in your Supabase project:

```bash
OPENAI_API_KEY=your_openai_api_key
PADDLE_API_KEY=your_paddle_api_key
```

## Database Structure

The function uses two tables:

1. `ad_generation_inputs` - Stores user requests
   - `user_email` - Email of the user
   - `prompt` - Text prompt provided
   - `transaction_id` - Paddle transaction ID for payment verification
   - `image_paths` - Array of paths to uploaded images
   - `created_at` - Timestamp when the record was created

2. `ad_generation_results` - Stores generation results
   - `user_email` - Email of the user
   - `result_image_urls` - Array of URLs to generated images
   - `created_at` - Timestamp when the record was created

## API Usage

### Request Format

```
POST /functions/v1/generate-gpt-images
```

Form Data:
```
prompt: "Create a lovely gift basket with these items in it"
userEmail: "user@example.com"
transactionId: "txn_01hv8wptq8987qeep44cyrewp9"
images: [FILE1]
images: [FILE2]
images: [FILE3]
```

Note: You can include multiple `images` fields with different files in the multipart form data.

### Response Format

Success:
```json
{
  "success": true,
  "images": [
    "https://supabase-storage-url/generated-ad-1.jpg",
    "https://supabase-storage-url/generated-ad-2.jpg"
  ]
}
```

Error:
```json
{
  "error": "Error message",
  "details": "Detailed error explanation"
}
```

## Implementation Details

The function follows this workflow:

1. Validate input data (prompt, email, transaction ID)
2. Check if the transaction has already been processed
3. Validate the transaction with Paddle API to ensure it has "completed" status
4. Process and store uploaded image files in Supabase Storage
5. Store request metadata in the database
6. Convert images to OpenAI-compatible format using the `toFile` utility
7. Send image files to OpenAI's API for processing
8. Receive base64-encoded images from OpenAI
9. Convert base64 data to files and store in Supabase Storage
10. Track generated image URLs in the database
11. Return the stored image URLs to the client

## Paddle Transaction Validation

The function integrates with Paddle's payment API to validate transactions:

1. Checks if the provided transaction ID exists in Paddle
2. Verifies that the transaction status is "completed"
3. Only proceeds with image generation if the transaction is valid
4. Prevents duplicate processing by tracking transaction IDs in the database

## OpenAI API Configuration

The function uses the following parameters when calling the OpenAI API:

- **model**: `gpt-image-1`
- **quality**: `auto` (automatically selects quality based on input)
- **size**: `1024x1024`
- **n**: 1 (generates 1 variation per request)

## Image Processing

The function handles various image processing tasks:

- Sanitizes filenames by removing spaces and special characters
- Converts files to OpenAI-compatible format using the `toFile` utility
- Creates unique storage paths for each uploaded and generated image
- Handles base64 encoding/decoding for image storage

## Limitations

- Maximum file size: 5MB per image
- Supported file types: JPG, PNG
- Each transaction ID can only be used once

## Local Development

1. Run `supabase start`
2. Make a test request:

```bash
curl -i --location --request POST 'http://127.0.0.1:54325/functions/v1/generate-gpt-images' \
  --form 'prompt="Create a lovely gift basket with these items in it"' \
  --form 'userEmail="user@example.com"' \
  --form 'transactionId="txn_01hv8wptq8987qeep44cyrewp9"' \
  --form 'images=@"/path/to/image1.jpg"' \
  --form 'images=@"/path/to/image2.jpg"'
```

## Deployment

Deploy to Supabase using the CLI:

```bash
supabase functions deploy generate-gpt-images
```

## API Documentation

- [OpenAI Image API Documentation](https://platform.openai.com/docs/api-reference/images/create)
- [OpenAI GPT-image-1 Model Guide](https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1)
- [Paddle API Documentation](https://developer.paddle.com/api-reference/transactions/get-a-transaction)
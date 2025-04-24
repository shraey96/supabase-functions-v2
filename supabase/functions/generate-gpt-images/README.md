# AI Ad Generator Function

This Supabase Edge Function allows users to generate product ads using OpenAI's image generation API (gpt-image-1) by providing multiple product images and a text prompt.

## Features

- Upload multiple product images for AI to reference
- Provide a text prompt to describe the desired ad style
- Generate multiple AI-based ad variations with high-quality outputs
- Store both input and generated images in Supabase Storage
- Track generation requests and results in database

## Prerequisites

1. Supabase project with Edge Functions enabled
2. OpenAI API key with access to the `gpt-image-1` model
3. Supabase Storage bucket for image storage

## Environment Variables

Set the following environment variables in your Supabase project:

```bash
OPENAI_API_KEY=your_openai_api_key
```

## Database Structure

The function uses two tables:

1. `ad_generation_inputs` - Stores user requests
   - `user_email` - Email of the user
   - `prompt` - Text prompt provided
   - `payment_token` - Payment verification token
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
paymentToken: "tok_test123"
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
    "https://supabase-storage-url/generated-ad-2.jpg",
    "https://supabase-storage-url/generated-ad-3.jpg"
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

1. Validate input data (prompt, email, payment token)
2. Process and store uploaded image files in Supabase Storage
3. Store request metadata in the database
4. Send image files directly to OpenAI's API (matching their documentation)
5. Receive base64-encoded images from OpenAI
6. Convert base64 data to files and store in Supabase Storage
7. Track generated image URLs in the database
8. Return the stored image URLs to the client

## OpenAI API Configuration

The function uses the following parameters when calling the OpenAI API:

- **model**: `gpt-image-1`
- **quality**: `hd` (high definition)
- **size**: `1024x1024`
- **style**: `natural`
- **n**: 3 (generates 3 variations)
- **response_format**: `b64_json` (to receive base64 data)

## Limitations

- Maximum file size: 5MB per image
- Supported file types: JPG, PNG

## Local Development

1. Run `supabase start`
2. Make a test request:

```bash
curl -i --location --request POST 'http://127.0.0.1:54325/functions/v1/generate-gpt-images' \
  --form 'prompt="Create a lovely gift basket with these items in it"' \
  --form 'userEmail="user@example.com"' \
  --form 'paymentToken="tok_test123"' \
  --form 'images=@"/path/to/image1.jpg"' \
  --form 'images=@"/path/to/image2.jpg"' \
  --form 'images=@"/path/to/image3.jpg"'
```

## Deployment

Deploy to Supabase using the CLI:

```bash
supabase functions deploy generate-gpt-images
``` 
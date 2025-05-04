// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

// Initialize Supabase client
const supabaseClient = createClient(
  ("https://eglwedwlixqeqiteygec.supabase.co" ||
    Deno.env.get("SUPABASE_URL")) ??
    "",
  ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbHdlZHdsaXhxZXFpdGV5Z2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0OTUzOTAsImV4cCI6MjA2MTA3MTM5MH0.RB6G5aXZ48MxSpzkSNZgGjYkTWo64dDDTBc8ejyQ38Y" ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ??
    ""
);

export default supabaseClient;

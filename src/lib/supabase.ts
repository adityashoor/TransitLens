import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://pqbxjzbdjxtttnnmmhaj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYnhqemJkanh0dHRubm1taGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTA3NTMsImV4cCI6MjA5NDc4Njc1M30.z2WsmaaltJ-IJZhomQhhI6Wma49z9cEjOWWu4iW5IhE"
);

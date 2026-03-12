import { createClient } from '@supabase/supabase-js'

export const lifeos = createClient(
  import.meta.env.VITE_LIFEOS_URL,
  import.meta.env.VITE_LIFEOS_KEY
)

export const ovb = createClient(
  import.meta.env.VITE_OVB_URL,
  import.meta.env.VITE_OVB_KEY
)

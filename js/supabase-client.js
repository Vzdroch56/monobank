// Подключение к Supabase через CDN (без сборки)
// URL проекта — БЕЗ /rest/v1/
const SUPABASE_URL = 'https://sgdbkatdkndpowtovegi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Fvt1EwiknbuW_r-6OcM90w_posqeFqG';

// SDK грузится через <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
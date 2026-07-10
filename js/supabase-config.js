/* =========================================================================
   supabase-config.js  —  Conexión a Supabase
   -------------------------------------------------------------------------
   La clave "anon public" está pensada para ser pública: la seguridad real
   la dan las políticas RLS en la base de datos (solo un usuario autenticado
   puede crear/editar/borrar; cualquiera puede leer).
   ========================================================================= */

const SUPABASE_URL = "https://hyjooucwhbvonveadtsa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5am9vdWN3aGJ2b252ZWFkdHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MjcyMjQsImV4cCI6MjA5OTIwMzIyNH0.tNX9KSV85PXI1IpqUnylU16Gf9J8r1t7k7vtJD40T3Y";

/* Nombre del bucket donde se guardan las fotos de productos. */
const SUPABASE_BUCKET = "productos";

/* Cliente único para todo el sitio. `supabase` viene de assets/vendor/supabase.js */
const sb = (typeof supabase !== "undefined" && supabase.createClient)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!sb) console.error("No se pudo iniciar Supabase: falta assets/vendor/supabase.js");

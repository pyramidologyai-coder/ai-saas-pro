"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dojbgvjrswktblkwwffx.supabase.co';
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvamJndmpyc3drdGJsa3d3ZmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzM5OTYsImV4cCI6MjA5MjI0OTk5Nn0.yKSHL2zh3yc6PjFppGa6dbkzd7b2gwaPKPlMlsSdPME';
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Check your .env.local file.');
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);

import { defineConfig } from '@prisma/config'
import 'dotenv/config' 

export default defineConfig({
  schema: "prisma/schema", // 👈 أضفنا هذا السطر السحري هنا ليقرأ المجلد الجديد بالكامل
  datasource: {
    url: process.env.DIRECT_URL,
  },
})
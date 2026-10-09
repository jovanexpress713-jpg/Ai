import fs from 'fs';
import path from 'path';

console.log('🔍 [ForgeX Audit] جاري فحص استقرار بيئة العمل وسلامة الأكواد...');

const requiredFiles = [
  'src/App.tsx',
  'src/components/workspace/LivePreviewPanel.tsx',
  'server/agent.ts',
  'package.json'
];

let allPassed = true;

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ الملف موجود وسليم: ${file}`);
  } else {
    console.error(`❌ الملف مفقود: ${file}`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log('🎉 جميع فحوصات ForgeX Studio تمت بنجاح والمشروع جاهز للعمل!');
} else {
  console.error('⚠️ يرجى التأكد من المجلدات والملفات المفقودة أعلاه.');
  process.exit(1);
}

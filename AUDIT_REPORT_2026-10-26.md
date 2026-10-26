# تقرير فحص شامل — FORGEX AI

**تاريخ الفحص:** 2026-10-26  
**الفرع:** `arena/a03a6c1b-ai` — من الالتزام `e256cee`  
**النطاق:** الكود المصدري (server + client)، سكربتات التحقق، التبعيات، Docker/CI، وسلوك الخادم قيد التشغيل.  
**المنهج:** تشغيل فعلي للأوامر + اختبارات HTTP حقيقية على نسخة مؤقتة من المشروع، وليس قراءة فقط.

---

## 1. الخلاصة التنفيذية

> **النتيجة: المشروع غير جاهز للنشر.** تقرير `FORGEX_FINAL_AUDIT.md` (بتاريخ 2026-10-08) يعلن «READY FOR DEPLOYMENT» ولا يحتوي على «ثغرات عالية الخطورة معروفة». الفحص المستقل كشف **5 ثغرات حرجة و4 عالية الخطورة**، من ضمنها تجاوز كامل للمصادقة في الإنتاج، وتعطّل تام لمسار التثبيت/الـ CI/بناء Docker، ونقطة ذكاء اصطناعي «وهمية» تُتلف ملفات المصدر.

**أخطر مشكلة منهجية:** سكربتات التحقق في المشروع تعطي **PASS دائماً** لأنها تبحث عن **نصوص داخل الكود** (`file.includes('...')`) ولا تختبر السلوك مطلقاً. لذلك فهي تُمرّر حتى عندما يكون التحكم معطّلاً. أمثلة:

| السكربت | ما يتحقق منه فعلياً | الحقيقة |
|---|---|---|
| `scripts/security-tests.mjs:15` | وجود النص `configuredPassword.length < 16` في `auth.ts` | هذا النص هو **باب التجاوز نفسه**، وليس شرط حماية |
| `scripts/security-tests.mjs` | وجود جملة `bubblewrap is required for isolated execution` | موجودة داخل `console.warn` فقط؛ الخادم يحذّر ثم ينفّذ على المضيف |
| `scripts/security-tests.mjs` | وجود `npm install` في CI | يمرّ رغم أن `npm install` نفسه يفشل بـ `ERESOLVE` |
| `scripts/verify-workspace.mjs:41` | عند غياب `node_modules` يُعيد رسالة «PASSED» | لم يتم تشغيل `tsc` إطلاقاً |
| `scripts/audit-studio.mjs` | وجود 4 ملفات فقط | لا يفحص محتوى ولا سلوكاً |

---

## 2. ما تم تنفيذه فعلياً (نتائج قابلة لإعادة الإنتاج)

| الأمر / الاختبار | النتيجة |
|---|---|
| `node scripts/security-tests.mjs` | PASS (غير ذو دلالة — انظر أعلاه) |
| `node scripts/verify-workspace.mjs` | PASS (غير ذو دلالة) |
| `node scripts/audit-studio.mjs` | PASS (يفحص وجود ملفات فقط) |
| `npm install --no-audit --no-fund` | ❌ **FAIL — ERESOLVE** |
| `npm install --legacy-peer-deps` | ✅ نجح (182–184 حزمة) |
| `npm run lint` / `npm run test` / `npm run build` (بعد التثبيت الاضطراري) | ✅ PASS |
| `npm install` + `npm run check` بعد حذف `esbuild` غير المستخدم | ✅ **PASS كامل** (الإصلاح المقترح مُختبَر) |
| `NODE_ENV=production` بكلمة مرور قصيرة + طلب بدون كوكي | ❌ **HTTP 200** على `/api/fs/tree` و`/api/db/data` |
| `Origin: https://evilrun.app` مع كوكي صالحة | ❌ **HTTP 200** (كان المفروض 403) |
| `verifyProposedChanges` بمسار `./package.json` | ❌ **success: true** (تجاوز الحماية) |
| دور `Viewer` يستدعي `/api/agent/process` | ❌ **HTTP 200** + إعادة كتابة ملف مصدر حقيقي |
| `npm run lint` بعد استدعاء `/api/agent/process` | ❌ يفشل بخطأي `TS2322` في `App.tsx` و`ProjectDevelopmentWorkspace.tsx` |

> جميع اختبارات HTTP أُجريت داخل نسخة مؤقتة (`.audit-tmp`) تم حذفها بعد الفحص؛ لم يُعدّل أي ملف مصدري في المستودع.

---

## 3. الثغرات الحرجة (Critical)

### C1 — تعطّل `npm install` ⇒ تعطّل CI وبناء Docker
`package.json:24` يثبّت `vite@8.3.0` الذي يشترط `esbuild@^0.27 || ^0.28`، بينما `package.json:35` يثبّت `esbuild@0.25.0`. النتيجة:

```
npm error ERESOLVE could not resolve
Conflicting peer dependency: esbuild@0.28.2
peerOptional esbuild@"^0.27.0 || ^0.28.0" from vite@8.3.0
```

يتأثر `Dockerfile:5` و`.github/workflows/ci.yml:22` و`npm run check` وكل تعليمات `README.md` المحلية. أي نشر من الصفر يفشل قبل سطر واحد من الكود.  
**الإصلاح المُختبَر:** حذف `esbuild` من `devDependencies` (غير مستورد في أي مكان بالمشروع) أو رفعه إلى `0.28.2`. بعد الحذف نجح `npm install` و`npm run check` بالكامل. ويُنصح بإضافة `package-lock.json`.

### C2 — تجاوز كامل للمصادقة في الإنتاج عند ضعف/غياب كلمة المرور
`server/auth.ts:83` يفتح «مسار التطوير» إذا كانت كلمة المرور غير مضبوطة أو أقل من 16 حرفاً، **دون التحقق من `NODE_ENV`**. والأسوأ أن `session()` و`requireAuth()` (الأسطر 117، 132، 152، 164) تمنح جلسة `Owner` تلقائياً في الإنتاج أيضاً بهذا الشرط، و`server.ts:666` يكتفي بـ `console.warn`.

اختبار فعلي (`NODE_ENV=production`, `FORGEX_ADMIN_PASSWORD=weak`):

```
[FORGEX AI] FORGEX_ADMIN_PASSWORD must be at least 16 characters ... using fallback authentication.
GET /api/fs/tree  (بدون كوكي) -> HTTP=200  ← قراءة كامل المشروع
GET /api/db/data  (بدون كوكي) -> HTTP=200  ← قاعدة البيانات والنسخ الاحتياطية
POST /api/deploy  (بدون كوكي) -> HTTP=502  ← تم تمرير فحص الصلاحية كـ Owner
```

مع كلمة مرور قوية `GET /api/fs/tree` يعيد 401 كما ينبغي — أي أن المشكلة هي **fail-open عند سوء الإعداد**، وهو أخطر سيناريو في النشر.  
**الإصلاح:** في الإنتاج، إذا غابت المتغيرات أو كانت ضعيفة ⇒ `process.exit(1)` برسالة واضحة (fail closed)، مع فحص `FORGEX_ADMIN_EMAIL` أيضاً.

### C3 — نقطة `/api/agent/process` مزيفة وتُتلف ملفات المصدر
`server.ts:169` يستدعي `processAgentTask()` (`server/agent.ts:559`) وهي **لا تستدعي Gemini إطلاقاً**. تُعيد رسالة جاهزة و`modifiedFiles` ثابتة، وتقوم بـ `writeWorkspaceFile('src/components/workspace/LivePreviewPanel.tsx', ...)` بمحتوى قالب ثابت. الواجهة الرئيسية تستخدمها (`src/App.tsx:191`).

الأضرار المؤكدة:
- بيانات وهمية تُعرض كنجاح (`src/App.tsx:206` و`223` — حتى في حالة فشل الشبكة يُعرض «تم بنجاح»).
- **لا يوجد أي فحص RBAC** على المسار: اختبرناه بدور `Viewer` ⇒ `HTTP 200` وتم تعديل الملف رغم أن `/api/fs/write` يرفض الدور نفسه بـ 403.
- إعادة كتابة المكوّن الحقيقي: النسخة الأصلية الأغنى (شريط معاينة، أوضاع viewport، iframe) لا تزال محفوظة في `data/forgex_db.json` تحت `fileBackups` — دليل على أن هذه النقطة مسحت ميزة حقيقية سابقاً.
- بعد الاستدعاء يفشل `npm run lint` بخطأي `TS2322` لأن القالب لا يقبل خاصية `lang`.
- حقن كود: النص يُحقن في قالب JavaScript بعد تهريب `"` فقط، دون تهريب `` ` `` أو `${...}` أو `{...}` ⇒ إمكانية حقن كود في الملف المُولّد.

**الإصلاح:** حذف المسار وتحويل الواجهة إلى `/api/agent/cycle` الحقيقي، أو إعادة كتابته ليعمل عبر Gemini مع RBAC وتحقق قبل الكتابة.

### C4 — تجاوز حماية «الملفات المحمية» في مسار التطبيق الذاتي
`server/sandbox.ts:125` يقارن المسار بالقائمة المحمية **قبل تطبيعه**: `protectedFiles.has(change.filePath)`. أي إضافة `./` تكفي لتجاوزها. اختبار فعلي على الدالة نفسها:

```
package.json                    -> success: false  (محمي)
./package.json                  -> success: true   ← تجاوز
./.github/workflows/ci.yml      -> success: true   ← تجاوز
```

ثم `applyTaskChanges()` (`server/agent.ts:457`) يكتب `change.filePath` في **مساحة العمل الحية** عبر `writeWorkspaceFile` بلا أي قائمة محمية. النتيجة: مقترح من Gemini (أو حقن prompt داخل سياق الملفات) يستطيع تعديل `package.json` و`Dockerfile` و`ci.yml` — أي تنفيذ أوامر عبر `npm run test` عند التشغيل التالي. سكربت الأمان يمرّر هذا لأنه يتحقق فقط من وجود أسماء الملفات داخل `sandbox.ts`.  
**الإصلاح:** تطبيع المسار (`path.posix.normalize`) قبل المقارنة + تطبيق نفس القائمة في `applyTaskChanges` قبل الكتابة الحية + اختبار سلوك فعلي بدل فحص النصوص.

### C5 — سقوط صامت لعزل التنفيذ في الإنتاج (عكس ما يدّعيه README)
`README.md` يقول: «If Docker is unavailable, FORGEX denies terminal execution rather than falling back to an unsafe host shell». الكود يقول العكس: `server/sandbox.ts:57-64`، عند غياب `bwrap` ينفّذ `execFileAsync` مباشرة على المضيف ما لم يكن `FORGEX_SANDBOX_REQUIRED === 'true'` — وهذا المتغير **غير مضبوط في صورة Docker** (يُضبط فقط في `docker-compose.yml`). أي تشغيل `docker run` مباشر في الإنتاج ينفّذ الأوامر على المضيف. كما أن `server.ts:669` يكتفي بالتحذير.

ومع أن قائمة الأوامر مقيّدة، إلا أن `npm run test` مسموح ومحتوى `package.json` قابل للتعديل عبر `/api/fs/write` ⇒ تصعيد إلى تنفيذ كود عشوائي على المضيف.  
**الإصلاح:** جعل `FORGEX_SANDBOX_REQUIRED` افتراضياً `true` في الإنتاج، ورفض التنفيذ عند غياب bwrap، وتصحيح توثيق README.

---

## 4. ثغرات عالية الخطورة (High)

| # | المشكلة | الدليل | الأثر / الإصلاح |
|---|---|---|---|
| H1 | `/api/agent/cycle` بلا RBAC عندما `autoApplyIfVerified` غير مفعّل | `server.ts:182-193` يفحص الصلاحية **داخل شرط** فقط | اختبرناه بدور `Viewer` ⇒ HTTP 200 مع مهمة جديدة. استهلاك حصة Gemini وإنشاء مهام من أي مستخدم. أضف `requirePermission(res,'APPLY_CHANGES')` دائماً. |
| H2 | فحص `Origin` قابل للتجاوز بـ substring | `server/security.ts:23` يستخدم `originUrl.host.includes('run.app')` و`.includes('localhost')` | اختبار فعلي: `https://evil.com` → 403، لكن `https://evilrun.app` و`https://localhost.attacker.com` → **200**. استخدم مطابقة دقيقة للـ host + قائمة بيضاء صريحة. |
| H3 | فحص `sameOriginForStateChange` يعتمد على `x-forwarded-host` غير موثوق | `server/security.ts:21` | الترويسة مأخوذة من الطلب نفسه، ومع `TRUST_PROXY=false` يمكن تزويرها بسهولة. اربط التحقق بـ `req.headers.host` فقط أو بقيمة مضبوطة في الإعدادات. |
| H4 | إعداد Docker Compose يمنع الكتابة فعلياً | `Dockerfile:23,27` + `docker-compose.yml:14-22` | `COPY . /workspace` و`data/` تُنفّذ كـ root ثم `USER node` مع `read_only: true` ⇒ المجلدات (volume) مملوكة لـ root، وكل `saveDb()` سيفشل بـ EACCES. أضف `--chown=node:node` أو `RUN chown`. |
| H5 | `tmpfs /tmp` بحجم 128MB مقابل نسخ 207MB | `docker-compose.yml:22` + `server/sandbox.ts:97,119` | `fs.cpSync` لا يستثني `node_modules` (207MB بعد التثبيت) ⇒ `ENOSPC` في كل عملية تحقق أو تطبيق ذاتي داخل Compose. استثنِ `node_modules` من الفلتر أو اربط المجلد بدل نسخه، وارفع حجم tmpfs. |
| H6 | حماية البنية التحتية لا تشمل مسار مدير الملفات | `server/workspace-fs.ts:162` | مستخدم بدور `Developer` يستطيع تعديل `server.ts` و`package.json` و`scripts/*` مباشرة، ثم ينتظر تنفيذ `npm run test` من مستخدم أعلى. ضع سياسة حماية موحّدة. |

---

## 5. ملاحظات متوسطة (Medium)

- **M1 — حالات «connected» وهمية:** `server.ts:94, 99, 109` تعلن قاعدة البيانات وبيئة التنفيذ والمعاينة «connected» بدون أي اختبار؛ `server.ts:86` يثبّت اسم الموديل `gemini-3.8-flash` بينما `server/agent.ts:37` يستخدم `gemini-3.1-flash-lite` كخيار أول لكل مهام التوليد. حالة Gemini في `/api/health` تعني «المفتاح موجود» لا «الاتصال ناجح».
- **M2 — `.env.example` ناقص:** لا يحتوي `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GITHUB_WORKFLOW`, `GITHUB_DEPLOY_REF`, `FORGEX_WORKSPACE_ROOT` رغم أن `server/deployment.ts` و`sandbox.ts` تعتمد عليها. نشر GitHub Actions سيفشل بصمت.
- **M3 — بيانات ملتزمة في Git:** `data/forgex_db.json` و`server/db.ts:136` يحتويان بريداً شخصياً (`hhhertwg@gmail.com`) وسجل تدقيق ومهام ونسخة احتياطية كاملة لملف مصدر داخل مستودع عام. يُفضل استبدالها بقيم عامة وإضافة `data/*.json` إلى `.gitignore`.
- **M4 — GitHub sync:** `server/github.ts:55-69` و`102` لا تتحقق من صيغة `owner/repo` أو اسم الفرع، وتُدرجها مباشرة في مسار API ⇒ حقن مسار/استعلام. كما أن المزامنة تدفع `data/forgex_db.json` مع الكود المصدري.
- **M5 — لا يوجد lockfile:** البناء غير قابل للتكرار، و`ci.yml` يعمل على `main/master` فقط ⇒ دفعات الفرع الحالي لا تُفحص. أضف `package-lock.json` ووسّع مشغّلات CI.
- **M6 — حماية إضافية ناقصة:** لا يوجد `Content-Security-Policy` ولا `X-Frame-Options`/`frame-ancestors`، و`Cross-Origin-Resource-Policy: cross-origin` permissive؛ الاعتماد على `SameSite=Strict` وحده.
- **M7 — تحديد المعدل على تسجيل الدخول فقط:** لا يوجد throttling على `/api/gemini/test`, `/api/agent/cycle`, `/api/github/sync`, `/api/deploy` ⇒ إساءة استخدام التكلفة/النشر. الجلسات في `Map` داخل الذاكرة ⇒ لا تدعم تعدد النسخ وتفقد عند إعادة التشغيل.
- **M8 — `/api/db/data`** (`server.ts:459`) يُعيد كامل قاعدة البيانات بما فيها `fileBackups` (محتوى ملفات كاملة) لدور `Reviewer`.

---

## 6. ما هو سليم فعلاً (تم التحقق منه)

- ✅ `tsc --noEmit` و`vite build` ينجحان بعد إصلاح C1 (بُنيت حزمة إنتاج 302KB).
- ✅ `resolveSafePath()` يمنع traversal والهروب عبر symlink بشكل عام، ويمنع قراءة `.env*`.
- ✅ الكوكي `HttpOnly; SameSite=Strict; Secure` في الإنتاج، ومقارنة `timingSafeEqual`، وتحديد محاولات الدخول.
- ✅ RBAC مطبّق على معظم مسارات الملفات، الطرفية، GitHub، النشر، ورفض المهام.
- ✅ الكتابة الذرية لقاعدة البيانات (`renameSync`) والـ rollback عند فشل التطبيق الذاتي.
- ✅ محوّل النشر يتصل فعلياً بالمزوّد ولا يعلن نجاحاً وهمياً.
- ✅ أسماء موديلات Gemini (`gemini-3.8-flash`, `gemini-3.1-flash-lite`) صحيحة ومتاحة حالياً.

---

## 7. خطة الإصلاح المقترحة (بالترتيب)

1. **C1** — حذف/ترقية `esbuild`، إضافة `package-lock.json`، ثم `npm install && npm run check`.
2. **C2** — fail-closed في الإنتاج عند نقص `FORGEX_ADMIN_EMAIL/PASSWORD`؛ إزالة مسار التطوير من `session()` و`requireAuth()`.
3. **C3** — حذف `/api/agent/process` أو إعادة تنفيذه عبر Gemini مع RBAC وتحقق، وإزالة رسائل النجاح الوهمية من `App.tsx`.
4. **C4** — تطبيع المسارات قبل فحص القائمة المحمية + تطبيق الحماية في `applyTaskChanges()`.
5. **C5** + **H4/H5** — افتراض `FORGEX_SANDBOX_REQUIRED=true` في الإنتاج، رفض التنفيذ بلا bwrap، `chown` للمجلدات، استثناء `node_modules` من النسخ أو رفع tmpfs.
6. **H1/H2/H3** — RBAC ثابت على مسارات الوكيل، ومطابقة `Origin` دقيقة.
7. **إعادة كتابة سكربتات التحقق** لتختبر السلوك (تشغيل خادم اختبار + طلبات HTTP + محاولات تجاوز) بدل `file.includes(...)`، وإضافة اختبارات تراجع(regression) لكل ثغرة أعلاه.
8. **M1–M8** — تنظيف `.env.example`، البيانات الشخصية، التحقق من مدخلات GitHub، وتوسيع CI.
9. تحديث `FORGEX_FINAL_AUDIT.md` و`RELEASE_VERIFICATION.txt` بعد الإصلاحات — التقريران الحاليان يوثّقان حالة غير صحيحة.

---

### خاتمة
المشروع يمتلك بنية تحتية جيدة (RBAC، عزل، تحقق قبل التطبيق، تدقيق)، لكن **طبقة التحقق الذاتي تمنح شعوراً زائفاً بالأمان**. قبل أي نشر يجب إصلاح البنود C1–C5 وتحويل سكربتات الفحص من «البحث عن نصوص» إلى «اختبار سلوك فعلي».

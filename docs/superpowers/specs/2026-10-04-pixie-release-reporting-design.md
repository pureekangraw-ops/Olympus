# PIXIE → OLYMPUS: รายงานท้ายขั้นปล่อยรุ่น
วันที่ 2026-10-04 (Asia/Bangkok)
Work: WORK-PIXIE-OLYMPUS-RELEASE-REPORTING-20261004-001
Checkpoint: CP-WORK-PIXIE-OLYMPUS-RELEASE-REPORTING-20261004-001
สถานะ: SPEC FOR REVIEW — ยังไม่มีโค้ดผลิตภัณฑ์หรือ deployment ถูกแก้

## ผลที่บิ๊กขอและข้อสรุปที่ตกลงแล้ว
ให้ PIXIE จับข้อมูลท้ายขั้นปล่อยรุ่นของโรงงาน แล้วส่งค่าให้ OLYMPUS เป็นบันทึกกลางของรุ่นปัจจุบัน AION อ่านเพื่อยืนยันและชี้เป้าหมาย เครื่องมือแต่ละตัวไม่ต้องมีตัวส่งรายงานเอง
ห้องเก่าและใหม่ที่อ่านสดต้องได้ค่าเดียวกัน GO เปรียบเทียบเอกสารในมือกับ Current และแจ้งความไม่ตรงกัน
สถานะ lifecycle/stage, ผลปล่อยรุ่น, Current และ runtime health เป็นคนละค่า
ขอบเขตแรกคือให้ ERGASTERION Factory Worker เป็นรุ่นจริงตัวแรกบนเส้นนี้ จากนั้นนำตัวรายงานเดียวกันไปใช้ใน workflow ปล่อยของ Hub, Olympus และ PRISM ตามหลักฐานการปล่อยเฉพาะแต่ละตัว การ build APK สำเร็จไม่เท่ากับติดตั้งบนโทรศัพท์แล้ว

## ความจริงที่ตรวจแล้ว
- Factory main b163c5e042b5c93111cc74fa188f58970f5bcd17
- Olympus main 15516b94929d1c728ce2fb26d3cc7b7e1f96b1b2
- Factory .github/workflows/cloudflare-deploy.yml deploy แล้วตรวจรายการ deployments แต่ยังไม่มีการส่ง Current และไม่มีการตรวจกลับ source/artifact ของตัวที่เสิร์ฟ
- Factory cloudflare/worker.mjs มี POST /api/olympus/current-report แต่ขาด destination/direct connection point และยังไม่มี authentication ที่ endpoint นี้
- Olympus cloudflare/worker.mjs มี POST /reports/current และ GET /aion/registry, POST /aion/resolve แต่รับ verified/evidence ที่ผู้เรียกส่งมาโดยไม่มีการยืนยันผู้รายงาน และ KV read-modify-write ยังไม่กันการเขียนแข่งหรือรายงานย้อนหลัง
- AION คืน target ได้เฉพาะ CURRENT + DIRECT; เป็น read-only resolver ไม่สร้าง Work ไม่ให้สิทธิ์ และไม่เปิดแอปเอง
- Hub dispatch PIXIE ask ได้ QUEUED และ readback ANSWERED ของ request PIXIE-OLYMPUS-RELEASE-20261004-001 แล้ว หลักฐาน runtime commit 2e8f64802b085396c60d6fe137ff5209780e9db7
- PIXIE ask เป็นคำตอบตามกฎจาก board ไม่ใช่ AI วิเคราะห์โค้ด คำตอบว่า 0 production/evidence handoffs จึงไม่ใช่หลักฐานว่า release ถูกตรวจแล้ว
- ชื่อ Go-Calalog- และ Ergasterion-factory อ่านได้ head/tree เดียวกัน ยังไม่ยืนยัน canonical rename ด้วย metadata จึงไม่สร้างหรือย้ายระบบจากชื่อเพียงอย่างเดียว

## แบบที่เลือก
ใช้โมดูลรายงานของ PIXIE ที่รันใน workflow ปล่อยรุ่นโดยตรง หลัง deploy และ readback ผ่าน ไม่ให้ GO Hub เป็นตัวรับรองการปล่อยแทนโรงงาน
ใช้ Olympus เป็นผู้รับรายงานที่ตรวจผู้ส่ง ลำดับ release และความครบของหลักฐาน AION ใช้สัญญาเดิมอ่าน Current
ทางเลือกที่ไม่เลือก: ติดตัวรายงานในทุกเครื่องมือ เพิ่มภาระกระจาย; ให้ Olympus ไล่ poll ทุกเครื่องมือ ไม่ตรงหลักการ push ที่บิ๊กกำหนด

## สัญญารายงาน
OLYMPUS_RELEASE_REPORT_V1:
- reportId: ไอดีรายงานที่ซ้ำแล้วได้ผลเดิม
- appId, owner: เจ้าของรุ่นที่ระบบรับรองผู้รายงานให้
- releaseSequence: ลำดับการปล่อยที่ Olympus จองก่อนเริ่ม deploy
- version, sourceRevision, artifactSha, runtimeIdentity: ตัวตนรุ่นที่ผูกกับ artifact ที่ปล่อยจริง
- destination: ปลายทางของ app profile ที่เจ้าของลงทะเบียนไว้
- provenanceRef: URL workflow run/job ที่ตรวจกลับได้
- outcome: RELEASE_FAILED | RELEASED | READBACK_VERIFIED
- evidence: แหล่งอ้างอิง deploy และ readback
- readback: observed version/sourceRevision/artifactSha/runtime identity และเวลาตรวจ
- workId/checkpointId: คงบริบทงานเมื่อเกิดจาก Work; deployment อัตโนมัติต้องอ้าง provenance ของ workflow จริง ไม่แต่ง Work
connectionPoint และ capabilityIds อยู่ใน app profile ที่ลงทะเบียนโดยเจ้าของ รายงานรุ่นไม่มีสิทธิ์เปลี่ยน target หรือ owner ตามใจผู้ส่ง

## จุดส่งในโรงงาน
1. ก่อน deploy: publisher ที่ยืนยันตัวตนแล้วจอง releaseSequence ใหม่กับ Olympus ผู้ส่งไม่เลือก sequence เอง
2. ขั้น build/deploy: สร้าง artifact ครั้งเดียว บันทึก hash และ source revision ของ artifact นั้น ไม่ใช้ hash ของ source file เดี่ยวแทน deploy bundle
3. deploy ล้มเหลว: ส่ง RELEASE_FAILED เพื่อบันทึกเหตุการณ์ Current คงเดิม
4. deploy สำเร็จ: อ่าน deployment identity และตัวที่เสิร์ฟจริง หากยังตรวจกลับไม่ครบ ส่ง RELEASED โดยไม่ตั้ง Current
5. readback ตรงกันทุก identity: ส่ง READBACK_VERIFIED ผ่าน PIXIE publisher จากนั้นอ่าน Olympus และ AION คืนเพื่อยืนยันรุ่น/target/ref
6. ส่งไม่สำเร็จ: workflow แสดง REPORTING_FAILED แยกจาก DEPLOYMENT_FAILED และคง report envelope เป็น artifact สำหรับ retry ด้วย reportId เดิม ห้ามปล่อยผ่านเงียบ
workflow ใช้ concurrency ต่อ app และไม่ยกเลิก deployment ที่กำลังทำครึ่งทาง การ rollback ใช้ releaseSequence ใหม่ แม้ version เก่ากว่า

## การรับและความคงเส้นคงวาใน Olympus
- ผู้ส่งต้องผ่าน credential ที่จำกัด appId/owner; ไม่ใช้ verified:true เป็น authority
- mutation ทุกทาง รวม /apps และ legacy /reports/current ต้องเข้ากลไกตรวจผู้ส่งและ serialization เดียวกัน ไม่มีทางเก่าข้าม guard
- ใช้ Durable Object เดียวสำหรับ registry state และ transaction ของ report/current เพื่อไม่ให้ KV eventual consistency และการเขียนแข่งสร้าง Current หายหรือย้อนรุ่น
- ย้าย snapshot KV เดิมแบบครั้งเดียวและคง backup/readback; หากข้อมูลเดิมมี conflict ห้ามเลือกผู้ชนะอัตโนมัติ
- READBACK_VERIFIED ต้องมี identity ตรงกับ reservation และ app destination ที่ลงทะเบียน
- reportId เดิม + payload เดิมเป็น idempotent; reportId เดิม + payload ต่างกัน reject
- sequence ต่ำกว่า Current reject STALE_RELEASE_REPORT; sequence เท่ากันแต่ identity ต่าง reject
- RELEASED/FAILED บันทึก history เท่านั้น ไม่แก้ app profile หรือ Current
- CURRENT เปลี่ยนเฉพาะ transaction ที่ผ่านทั้งหมด การ conflict capability ต้อง reject โดยไม่มี state mutation
- release sequence ไม่ใช้เลข version หรือ timestamp จากผู้ส่งตัดสินลำดับ
- response ทุก read ใช้ cache-control:no-store; reads ทั้ง Current และ AION ใช้ durable state เดียวกัน

## AION และผู้เปิดเป้าหมาย
คง GET /aion/registry และ POST /aion/resolve เดิมสำหรับ consumers
target/ref ปล่อยเฉพาะ Current ที่ verified และ DIRECT หากข้อมูลไม่ครบคืน UNKNOWN พร้อม target:null
ผู้เปิดต้องอ่านสด ยืนยัน requested version/source/artifact/destination แล้วจึงใช้ target ภายใต้สิทธิ์เดิม ไม่สร้างสิทธิ์ใหม่จาก Current
การเปิด UI จริงต้องทดสอบกับ consumer ที่มีอยู่ เช่น Office/PRISM แยกจาก resolver test ตอนนี้ end-to-end ของผู้เปิดเป็น UNKNOWN ต้องสำรวจ caller ก่อนเปลี่ยน
การอ่านจากสองห้องเป็นสอง fresh requests ไม่อ้าง cache หรือความจำในแชทเป็น Current

## ขอบเขตไฟล์ที่จะเปลี่ยน
Olympus:
- cloudflare/worker.mjs: receiver/reads ผ่าน durable state, authenticated owner scope
- cloudflare/release-registry.mjs: transactional registry/reservation/report validation
- wrangler.jsonc: Durable Object binding/migration
- test/cloudflare-release-report.test.mjs: failure, ordering, idempotency, owner scope และ AION readback
Factory:
- pixie-lab-v1/pixie-lab/release-publisher.mjs: shared publisher ตรวจ envelope ส่งและอ่านกลับ
- pixie-lab-v1/release-report-cli.mjs: workflow entry ไม่มี merge/deploy authority
- cloudflare/worker.mjs: release metadata readback จาก artifact ที่ deploy และแก้ legacy report relay ให้ผ่าน authenticated receiver
- .github/workflows/cloudflare-deploy.yml: capture artifact/deployment/readback และเรียก publisher ท้ายการปล่อย
- .github/workflows/olympus-deploy.yml: deploy bindings/config ของ receiver และ isolated E2E ด้วย credential fixture ไม่เขียน dummy Current ใน production
- pixie-lab-v1/test/release-publisher.test.mjs: transport/failure/readback tests
Hub/Office/PRISM consumer:
- ใช้ AION adapter เดิมก่อน; เปลี่ยนไฟล์ caller เฉพาะหลังสำรวจ current code และระบุจุดเปิดจริง
- ขอบเขตนี้ไม่ลบ legacy AION entry ไม่เปิด Work/route ผ่าน release proof

## การตรวจที่ต้องผ่าน
- deploy fail ไม่เปลี่ยน Current
- deploy success แต่ไม่มี readback ไม่เปลี่ยน Current
- source/artifact/destination/runtime mismatch ไม่เปลี่ยน Current
- ผู้ส่งผิด owner/app หรือไม่มี credential reject ก่อน mutation
- duplicate identical report ไม่เพิ่ม lineage; conflicting duplicate reject
- delayed old report ไม่ย้อน Current; rollback ที่มี sequence ใหม่และ readback ถูกต้องทำได้
- concurrent reports ได้ Current เดียวโดยไม่ทำ snapshot ของ app อื่นหาย
- pending/failed report ห้ามเปลี่ยน target ของ Current เก่า
- capability conflict ไม่มี partial mutation
- AION resolves verified release; stale/missing/mismatch ไม่ปล่อย target
- สอง fresh consumers อ่าน revision/version/target ตรงกัน
- isolated production-like E2E และ live real-release readback เป็นคนละหลักฐาน
- งานแรกจบเป็น PR + CI ผ่าน; production ใช้งานสำเร็จต้องมี deployment และ real readback เพิ่ม ห้ามเรียก PR ว่าสายจริงเสร็จ

## การตั้งค่าที่ต้องตรวจตอนลงมือ
ต้องตรวจว่ามี credential scope ระหว่าง workflow/PIXIE และ Olympus หรือไม่ ยังเป็น UNKNOWN ไม่มีการสร้าง/แสดง secret ในแชท
ถ้าไม่มี จะทำโค้ดและ PR ให้ตรวจได้ก่อน แล้วระบุขั้นตั้งค่า credentials เป็น hard block ของ live deployment
ไม่เปลี่ยนระบบอื่น ไม่ถือ health endpoint ที่บอก READY เป็นหลักฐาน exact release

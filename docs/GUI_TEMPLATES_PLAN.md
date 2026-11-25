# GUI Templates Roadmap — Player Head / Player Model / Modern Styles

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

Design plan extending `GUI_STUDIO.md` (§1.1) with player-centric elements and non-pixel style families:

- **2D/3D Player Heads:** TextDisplay `player` object component (Paper 1.21.9+) or ItemDisplay `player_head` on Java; URL `FormImage` binding on Bedrock.
- **Full Player Models:** `Mannequin` entity (Paper 1.21.9+) on Java with poses, armor, and scale; `live_player_renderer` / URL fallback on Bedrock.
- **Planned Style Families (via 2D Shapes + 4× detail):** Glass modern, Flat minimal, Neon cyber, Esports angular, Pastel kawaii, Luxury gold, RPG dark fantasy, alongside the 18 existing Pixel Classic kits.
- **Layouts:** Character/Equipment, Profile v2, Leaderboard, Party/Lobby, Friends, Duel, Clan, Battle Pass, Quests, Crate/Gacha, Store, Settings, etc. (Leaderboard, Friends, Character, Party, and Duel are already implemented in the pixel kit.)

---

## ภาษาไทย

# แผนเทมเพลต GUI ชุดใหม่ — Player Head / Player Model / สไตล์โมเดิร์น (2026-11-24)

> ต่อจาก GUI_STUDIO.md ข้อ 1.1 · **ชุดแรกทำแล้ว (CHANGELOG 32):** Leaderboard / Friends / Character / Party / Duel ในระบบ pixel kit เดิม · ตารางสไตล์ในข้อ 3 เป็นแค่ไอเดีย ต้องทำใน engine (`gs_templates.js` / Shape 2D) ไม่ใช่ HTML

## 1. ทำได้ไหม — สรุปตามฝั่ง

| ของ | Java (KaizerUI hologram) | Bedrock (server form) |
|---|---|---|
| **หัวผู้เล่น 2D** | text component แบบ `object` → `player` (มีตั้งแต่ 1.21.9, Adventure `PlayerHeadObjectContents`) ใส่ใน TextDisplay ได้เลย ขนาดตาม scale ของ text · ใส่ `%player_name%` หรือชื่อใดก็ได้ (top 1, เพื่อน) | ข้อความ/รูปปุ่มของ form: ส่งรูปปุ่มเป็น URL (`FormImage URL`) เช่นบริการรูปหัวจากชื่อ แล้ว pack bind `#form_button_texture` + `file_system` ของ item นั้น — ต้องมีเน็ตฝั่ง client |
| **หัวผู้เล่น 3D** | ItemDisplay ถือ `player_head` + profile (หมุนได้ด้วย Motion) | — (ใช้ 2D) |
| **ตัวเต็ม (ตัวเอง)** | entity **Mannequin** (1.21.9+, Paper `org.bukkit.entity.Mannequin`): `setProfile`, pose (standing/crouching/swimming/fall_flying/sleeping), ใส่เกราะ/ของในมือ, ซ่อนป้าย description, scale ด้วย attribute · ซ่อนจากคนอื่นแบบเดียวกับ TextDisplay (`setVisibleByDefault(false)` + `showEntity`) | `renderer: live_player_renderer` (ตัวที่ใช้ในหน้า inventory) แสดงตัวผู้เล่นที่เปิดเมนูเอง ขยับตามจริง — **ต้องลองในเกมว่าใช้ใน server_form ได้** |
| **ตัวเต็ม (คนอื่น)** | Mannequin ใส่ profile ของคนนั้น | รูป 2D จาก URL (ภาพ render ตัว) |

ข้อควรรู้ Java Mannequin:
- เป็น LivingEntity → แสงตามบล็อกที่ยืน (กลางคืน/ถ้ำมืด) ไม่มี brightness override แบบ display entity → ทางแก้: วางเมนูให้ตัวอยู่ใกล้กล้อง + ตั้ง `light` ของ panel ให้สว่างเท่ากัน หรือเปิดตัวเลือก "night vision ชั่วคราว" (ยังไม่ตัดสิน)
- วาง Mannequin ระหว่างกล้องกับ panel (ใกล้กล้องกว่าเล็กน้อย) ไม่งั้นโดนพื้นหลังบัง · ต้องหมุนตามมุมเมนู
- client ต้อง 1.21.9 ขึ้นไป (ผ่าน ViaVersion รุ่นเก่า → fallback เป็นหัว ItemDisplay)

## 2. element ใหม่ที่ต้องเพิ่มใน GUI Studio
1. **Player Head** — `who: viewer | name | placeholder` (เช่น `%ajlb_lb_..._1_alltime_name%`), size, flat/3D, hat layer, กรอบ (shape)
2. **Player Model** — `who`, pose, หมุน (องศา + Loop Spin/Sway ของ Motion), ใส่ชุดตัวเอง on/off, scale · ในโปรแกรมพรีวิวด้วย skin Steve/Alex (หรือโหลด skin จากชื่อตอนออนไลน์)
3. (ต่อยอด) **Progress bar** (ค่าจาก PAPI), **Item icon** (ของจริงใน ItemDisplay / Bedrock รูป), **Badge/Pill**, **Divider**
4. **ฟอนต์โมเดิร์น** สำหรับสไตล์ที่ไม่ใช่ pixel: Java = TTF provider ใน pack (เช่น Inter + Noto Sans Thai) ระบุ `font` ต่อ label · Bedrock = `font_type: smooth` / `MinecraftTen` (ต้องลอง)

## 3. ตระกูลสไตล์ (style family) — เพิ่มจาก kit pixel เดิม
| family | ลักษณะ | วาดด้วย |
|---|---|---|
| Pixel classic (เดิม 18 kit) | กรอบโลหะ ramp 6 เฉด | engine เดิม |
| Glass modern | แผงโปร่งแสง ขอบขาวบาง มุมมน 12–16 | Shape 2D + alpha, Detail 4× |
| Flat minimal | การ์ดขาว/เทาเรียบ เงาจาง เส้นแบ่งบาง | Shape 2D |
| Neon cyber | พื้นดำ เส้นขอบ cyan/magenta มุมตัด | Shape 2D chamfer + เส้น |
| Esports angular | ดำ + แดง ตัวหนังสือใหญ่ ปุ่มเฉียง | polygon |
| Pastel kawaii | ชมพู/ครีม มุมมนมาก ป้ายฟองสบู่ | Shape 2D round |
| Luxury gold | ดำ + เส้นทองบาง ฟอนต์ serif | เส้น 1px + TTF |
| RPG dark fantasy | ม่วงเข้ม ช่อง slot ขอบทอง | pixel หรือ 2D |
| (เพิ่มได้) Retro terminal, Comic/brutalist, Material You, Wood cozy |

หลักการ: Java ไม่มี blur ข้างหลัง → "กระจก" = โปร่งแสง + ขอบสว่าง ไม่เบลอ · ทุกสไตล์ใช้ Detail 4× (มีอยู่แล้ว) ให้ขอบเนียน

## 4. layout ใหม่ (ใช้ได้กับทุก family)
**มีหัว/ตัวผู้เล่น**
- Character / Equipment — ตัวเต็มกลาง + ช่องเกราะซ้าย/ขวา + stat
- Profile card v2 — ตัวเต็มหรือหัวใหญ่ + level bar + badges
- Leaderboard — podium 3 คน (หัว/ตัว) + รายการ 4–10 + แถว "คุณ"
- Party / Lobby — 1–4 ตัวยืนเรียง + ปุ่ม Ready / Invite
- Friends list — หัว + สถานะออนไลน์/เซิร์ฟ
- Duel / Compare — 2 ตัวหันหน้าเข้าหากัน + stat เทียบกัน
- Clan / Guild — ตราแคลน + หัวสมาชิก + rank
- Player info (คลิกคนอื่น) — หัว + ปุ่ม Trade / TPA / Report
- Welcome / Login — ตัวเต็มโบกมือ (Loop) + ปุ่ม Play
**ไม่ต้องใช้หัว**
- Battle pass / Season, Quest board, Crate / Gacha, Rank (VIP) store, Kit selector, Settings (toggle), Mail / Inbox, Teleport request (Accept/Deny), Vote rewards, Minigame selector แบบการ์ดใหญ่ + จำนวนคน

## 5. ลำดับที่เสนอ
1. Player Head (Java object component + Bedrock URL) + layout Leaderboard / Friends / Profile v2
2. Style family 2D 3 ชุดแรก: Glass, Flat, Neon (ใช้ Shape 2D ที่มีอยู่)
3. Player Model (Mannequin) + layout Character / Party / Duel — ทดสอบแสงและ ViaVersion
4. ฟอนต์ TTF + family ที่เหลือ + layout ที่ไม่ใช้หัว

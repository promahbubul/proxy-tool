# SmartFill Pro - Windows Floating Overlay & Auto-Fill Assistant 🚀

**SmartFill Pro** হলো একটি পাওয়ারফুল উইন্ডোজ প্রোডাক্টিভিটি অ্যাপ যা **GoLogin, GeeLark, AdsPower, Dolphin{anty}** সহ যেকোনো ব্রাউজার ও সফটওয়্যারে চোখের পলকে প্রক্সি এবং ক্রেডেনশিয়াল অটোমেটিক ফিল আপ (Auto-Fill) করতে পারে।

---

## ✨ মূল ফিচারসমূহ (Key Features)

1. **Always-On-Top Floating Overlay (ভাসমান টুলবার):**
   - স্ক্রিনের অন্য সব সফটওয়্যারের একদম উপরে ভেসে থাকে।
   - মাউস দিয়ে টেনে স্ক্রিনের যেকোনো জায়গায় রাখা যায়।
   - বর্তমানে কোন প্রক্সিটি সিলেক্ট করা আছে তা স্পষ্টভাবে দেখতে পারবেন।
   - এক ক্লিকেই **Fill**, **Copy**, **Next**, **Prev** করা যায়।

2. **স্মার্ট অটো-ফিল ইঞ্জিন (Instant Auto-Fill):**
   - GoLogin বা GeeLark-এর Proxy Host/IP ফিল্ডে কার্সার রেখে কিবোর্ডে **`Alt + F`** চাপলে (অথবা ভাসমান বারের **Fill** বাটনে ক্লিক করলে) এটি স্বয়ংক্রিয়ভাবে:
     $$\text{Host} \longrightarrow [\text{Tab}] \longrightarrow \text{Port} \longrightarrow [\text{Tab}] \longrightarrow \text{Username} \longrightarrow [\text{Tab}] \longrightarrow \text{Password}$$
     সিকোয়েন্সে বিদ্যুৎ গতিতে টাইপ করে দেয়।
   - বিশেষ চিহ্নযুক্ত পাসওয়ার্ডেও কোনো ভুল বা টাইপো হয় না।
   - প্রতিটি প্রক্সি ফিল করার পর স্বয়ংক্রিয়ভাবে পরবর্তী প্রক্সিতে সুইচ করে (Auto-Advance)।

3. **প্রক্সি ও ক্রেডেনশিয়াল ড্যাশবোর্ড (Proxy Hub):**
   - **CSV Drag-and-Drop & Bulk Import:** এক ক্লিকে শত শত বা হাজার হাজার প্রক্সি লোড করা যায়।
   - **সাপোর্টেড ফরম্যাট:**
     - `198.51.100.10:8080:username:password`
     - `198.51.100.10:8080`
     - `http://username:password@198.51.100.10:8080`
     - `socks5://username:password@198.51.100.10:1080`
     - কমা-সেপারেটেড স্ট্যান্ডার্ড CSV
   - **ম্যানেজমেন্ট:** প্রক্সি সার্চ, ফিল্টার (HTTP/SOCKS5, Ready/Used), এডিট, ডিলিট এবং এক ক্লিকে ক্লিপবোর্ডে কপি।

4. **গ্লোবাল কিবোর্ড শর্টকাট (Global Hotkeys):**
   - `Alt + F` : টার্গেট অ্যাপে সরাসরি অটো-ফিল (Auto-Fill Now)
   - `Alt + N` : পরবর্তী প্রক্সিতে যাওয়া (Next Proxy)
   - `Alt + C` : বর্তমান প্রক্সি ফরম্যাট কপি করা (Copy to Clipboard)

---

## 🛠️ কীভাবে চালাবেন (How to Run)

১. টার্মিনাল বা পাওয়ারশেলে এই ফোল্ডারে এসে টাইপ করুন:
```bash
npm start
```

অ্যাপটি চালু হলে দুটি উইন্ডো দেখতে পাবেন:
1. **মূল ড্যাশবোর্ড:** যেখানে আপনি প্রক্সি যুক্ত, ইমপোর্ট এবং দেখতে পারবেন।
2. **মিনি ফ্লোটিং টুলবার:** যা আপনার স্ক্রিনের যেকোনো কাজের সময় ভাসমান থাকবে।

---

## 🎯 বিভিন্ন ব্রাউজারে ব্যবহারের নিয়ম (Target Browser Presets)

ভাসমান টুলবারে একটি **Browser Selector** দেওয়া আছে:
- **✨ Smart Detect (Auto) [Recommended]:** এটি পেজে থাকা সমস্ত ইনপুট বক্স স্ক্যান করে সরাসরি `Host`, `Port`, `Username`, `Password`, এবং `Proxy Type` খুঁজে বের করে নিজে থেকেই সঠিক বক্সে মান বসায়! কার্সার যেখানেই থাকুক, এটি নিখুঁতভাবে ফিল করবে।
- **GeeLark (Type First):** GeeLark-এর `Type` ড্রপডাউনে (`DECODO` বা যেটাই থাকুক) ক্লিক করে `Alt+F` চাপলে স্বয়ংক্রিয়ভাবে প্রোটোকল (SOCKS5/HTTP) সিলেক্ট হবে, Host, Port, Username, Password ফিল হবে এবং শেষে Check Proxy বাটনে ক্লিক করে ভেরিফিকেশন কমপ্লিট করবে!
- **GeeLark (Host Box):** GeeLark-এর `Host` বক্সে ক্লিক করে `Alt+F` চাপলে Host, Port, Username, Password ফিল হবে এবং Check Proxy টেস্ট হবে।
- **GoLogin:** GoLogin-এর Proxy Type ড্রপডাউনে কার্সার রেখে `Alt+F` চাপলে ড্রপডাউন সিলেক্ট করে IP, Port, Username, Password ফিল করে।
- **AdsPower:** AdsPower-এর Host ফিল্ডে কার্সার রেখে `Alt+F` চাপলে Host, Port, User, Password অটো-ফিল হয়।
- **Dolphin{anty}:** Dolphin-এর "New proxy" বক্সে কার্সার রেখে `Alt+F` চাপলে এক লাইনে পুরো প্রক্সি পেস্ট হয়ে সম্পূর্ণ কনফিগার হয়ে যায়।
- **Universal:** যেকোনো সফটওয়্যার বা ব্রাউজারের IP/Host বক্সে কার্সার রেখে `Alt+F` চাপলে সরাসরি Host -> Tab -> Port -> Tab -> User -> Tab -> Pass ফিল করে।

---

## 📦 সিঙ্গেল `.exe` ফাইল বানানোর নিয়ম

ভবিষ্যতে কোনো নোড বা কমান্ড লাইন ছাড়া ডাবল-ক্লিকে চালানোর জন্য `.exe` ফাইল বানাতে:
```bash
npm install -g electron-builder
npm run build
```
এটি `dist/` ফোল্ডারে একটি পোর্টেবল `.exe` ফাইল তৈরি করে দেবে।

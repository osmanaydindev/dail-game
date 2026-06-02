# Phase 03 — Socket & Rooms

## Amaç
Oda yönetimi (memory) + Socket.IO event akışını kurmak. Tavla'yı bozmadan,
Kızma Birader'i ayrı namespace'e bağlamak. Tüm hamleleri backend doğrular.

## Değiştirilecek / Oluşturulacak dosyalar
- `apps/backend/src/kizmaBirader/rooms.ts` (yeni)
- `apps/backend/src/kizmaBirader/socketHandler.ts` (yeni)
- `apps/backend/src/tavla/socketHandler.ts` (**minimal**: `attachTavlaSocket` artık
  oluşturduğu `io` instance'ını `return` eder — davranış değişmez)
- `apps/backend/src/server.ts` (Kızma attach eklenir)

## Mimari
- `server.ts`:
  ```ts
  const io = attachTavlaSocket(httpServer); // io döner
  attachKizmaBiraderSocket(io);             // /kizma namespace
  ```
- Kızma, `io.of('/kizma')` namespace'inde kendi auth middleware'i (Tavla'daki
  JWT verify deseninin aynısı) ile çalışır. Tavla default namespace'te kalır.
- Socket.IO path değişmez: `/api/socket.io`.

## Oda kuralları
- Oda kodu: Tavla'daki `generateCode` deseni (6 karakter).
- Oda 1–4 oyuncu tutar; oyuncu lobby state'i: `color | null`, `ready`, `connected`.
- Host = ilk giren. Host `kizma:start` ile başlatır; **< 3 hazır+renkli oyuncu**
  varsa başlatamaz.
- Renk seçmeden `ready` olunamaz. Aynı renk iki oyuncuya verilemez.
- Disconnect → `connected=false`, oda yaşar; `kizma:rejoin` ile dönüş.

## Eventler
İstemci→Sunucu: `kizma:create`, `kizma:join`, `kizma:select_color`,
`kizma:ready`, `kizma:start`, `kizma:roll`, `kizma:move`, `kizma:rejoin`.
Sunucu→İstemci: `kizma:state` (oyun state + oda), `kizma:lobby` (lobby state),
`kizma:error`, `kizma:player_joined`, `kizma:player_left`, `kizma:reconnected`,
`kizma:created`, `kizma:game_start`.

## Doğrulama
- `kizma:roll`: sıra o oyuncuda + phase `rolling` değilse reddet.
- `kizma:move`: hamle `getLegalMoves` içinde değilse `kizma:error`.
- Renk çakışması, <3 oyuncu başlatma, renk seçmeden ready → reddedilir.

## Kabul kriterleri
- `npm run build --workspace=apps/backend` hatasız.
- İki socket server çakışmaz; Tavla bağlantısı bozulmaz.
- Tüm hamleler sunucuda doğrulanır.

## Manuel test adımları
- İki/üç tarayıcı sekmesinde bağlan, oda oluştur/katıl, renk seç, ready, start.
- Geçersiz hamle gönder (devtools) → `kizma:error`.
- Bir sekmeyi yenile → rejoin ile state geri gelir.

## Bilinen riskler
- Namespace auth middleware'i Tavla'dan kopyalanır; JWT secret/payload aynı.
- Bellek-içi oda: sunucu restart'ında oyunlar kaybolur (Tavla ile aynı, kabul).

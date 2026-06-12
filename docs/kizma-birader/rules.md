# Kızma Birader — Kural Seti (Otorite Kaynak)

Bu dokümanda uygulanan kurallar **bağlayıcıdır**. Backend engine bu kuralları
birebir uygular; frontend yalnızca görselleştirir ve backend'in doğruladığı
hamleleri gönderir. İstemciye güvenilmez.

Kızma Birader, uluslararası adıyla **Ludo / Pachisi** ailesinden bir oyundur.
Aşağıdaki kural seti standart Ludo mantığına dayanır ve tutarlı olacak şekilde
sabitlenmiştir.

---

## 1. Oyuncular ve Renkler

- Oyun **3 veya 4 oyuncu** ile oynanır.
- Renkler: **red (kırmızı), blue (mavi), yellow (sarı), white (beyaz)**.
- Renkler **otomatik atanmaz**. Her oyuncu lobby'de boş bir rengi kendisi seçer.
- Aynı renk iki oyuncuya verilemez.
- **Tur sırası** her zaman sabit renk döngüsüne göre ilerler:
  `red → blue → yellow → white → red ...`
  Oyunda bulunmayan (seçilmemiş) renkler bu döngüde **atlanır**.
- 3 oyunculu oyunda kullanılmayan renk **pasif**tir: o renge ait taş, başlangıç
  alanı ve ev sütunu board üzerinde çizilir ama oyuna katılmaz, sıra ona gelmez.

## 2. Taşlar ve Alanlar

- Her oyuncunun **4 taşı** vardır.
- Başlangıçta 4 taş da kendi renginin **ev alanında (yard)** bekler.
- Board, klasik Ludo gibi **15×15** hücrelik bir çapraz (artı) yol içerir:
  - **Ortak halka (ring):** 52 hücre, global indeks `0..51`.
  - Her rengin **6 hücrelik özel ev sütunu (home column)** vardır; sona varış
    (goal / merkez) buradadır.
  - Her rengin **4 hücrelik yard (başlangıç köşesi)** vardır.

## 3. Taş Konumu (pos) Modeli

Bir taşın konumu tek bir tamsayı `pos` ile ifade edilir:

| pos değeri | Anlamı |
|------------|--------|
| `-1`       | Yard (henüz çıkmadı) |
| `0..51`    | Ortak halkada; global hücre = `(START[color] + pos) % 52` |
| `52..57`   | Ev sütunu (6 hücre); `52` ilk ev hücresi … `57` = goal (bitiş) |
| `57`       | Taş **bitti** (goal'a ulaştı) |

**Renk başlangıç offsetleri (START):**

| Renk   | START offset | Güvenli start hücresi (global) |
|--------|--------------|-------------------------------|
| red    | 0            | 0  |
| blue   | 13           | 13 |
| yellow | 26           | 26 |
| white  | 39           | 39 |

- Halka relative `0..51` = 52 hücre. relative `51` global olarak `(START-1)%52`
  hücresine denk gelir; bu, taşın kendi start hücresinin **bir öncesi**dir ve
  taş buradan ev sütununa sapar. Taş bir tur sonra kendi start hücresine
  **tekrar basmaz** (relative `52` artık ev sütunudur).
- Goal'a ulaşmak için **tam sayı** gerekir: `pos + zar > 57` ise hamle geçersizdir
  (overshoot yok).

## 4. Zar ve Tur Akışı

1. Sırası gelen oyuncu zar atar (`1..6`).
2. **Evden çıkış:** Bir taşı yard'dan (`pos = -1`) çıkarmak yalnızca **6** atınca
   mümkündür; taş start hücresine (`pos = 0`) gelir.
3. **6 ekstra hak:** Oyuncu 6 attıysa, hamlesini yaptıktan sonra **tekrar zar
   atar** (ekstra tur). 6 olmayan zarda hamle sonrası sıra geçer.
4. **Üç 6 kuralı:** Aynı oyuncu üst üste **üç kez 6** atarsa, son atış iptal olur
   (o turdaki hamle uygulanmaz) ve sıra bir sonraki oyuncuya geçer. Bu, sonsuz
   6 sömürüsünü engeller.
5. **Hamle zorunluluğu:** Geçerli (legal) hamle varsa oyuncu hamlesini **yapmak
   zorundadır**. Hiç legal hamle yoksa sıra otomatik geçer (6 atılmış olsa bile
   evden çıkacak/oynayacak taş yoksa ekstra hak kullanılmaz, tur geçer).

## 5. Kırma (Capture)

- Bir taş, ortak halkadaki (`pos 0..51`) bir hücreye gelir ve o hücrede
  **rakibe ait tam olarak 1 taş** varsa, o rakip taş **yard'a geri döner**
  (kırılır). Kıran oyuncuya ekstra hak verilmez (yalnızca 6 ekstra hak verir).
- **Güvenli karelerde kırma olmaz** (bkz. Bölüm 6).
- Ev sütunu (`pos 52..57`) **özeldir**; orada kırma yoktur.

## 6. Güvenli Kareler (Safe Squares)

Aşağıdaki global halka hücreleri güvenlidir; bu hücrelerdeki taşlar **kırılamaz**
ve burada farklı renkten taşlar bir arada durabilir:

```
Güvenli global hücreler = { 0, 8, 13, 21, 26, 34, 39, 47 }
```

- `{0, 13, 26, 39}` = renklerin start hücreleri.
- `{8, 21, 34, 47}` = klasik "yıldız" hücreleri (her start + 8).
- Güvenli karelere **herkes gidebilir, sınırsız sayıda taş** bir arada durabilir;
  blok kuralı (Bölüm 7) güvenli karelerde **işlemez**.

## 7. Kendi Taşlarının Aynı Karede Durması (Stacking / Block)

**Karar:** Aynı renkten taşlar **aynı karede üst üste durabilir** (stack serbest).

- **Güvenli olmayan** bir karede aynı renkten **2 veya daha fazla** taş varsa, bu
  kare bir **blok** oluşturur: rakip taş bu kareye **gelemez** (hamle geçersizdir)
  ve bu taşlar kırılamaz.
- Bir karede rakibe ait **tek** taş varsa ve kare güvenli değilse, gelen taş onu
  kırar.
- **Güvenli karelerde blok kuralı işlemez**: rakip kaç taş olursa olsun herkes
  güvenli kareye inebilir, sınırsız sayıda taş bir arada durabilir ve güvenli
  karede kırma zaten yoktur.

> Özet: Kendi taşların serbestçe üst üste binebilir; güvenli olmayan karedeki
> iki+ taşlık yığın rakip için aşılmaz bir blok ve kırılmaz bir bütündür.
> Güvenli kareler ise herkese açıktır.

## 8. Kazanma

- Bir oyuncu **4 taşının 4'ünü de** goal'a (`pos = 57`) sokunca **kazanır** ve
  oyun biter (`phase = 'ended'`, `winner` o oyuncunun rengi).
- v1'de oyun ilk bitiren oyuncu kazandığında sona erer (sıralama / 2.lik yok).

## 9. Bağlantı / Yeniden Bağlanma

- Oda state'i bellekte tutulur (Tavla ile tutarlı).
- Disconnect olan oyuncu `connected=false` işaretlenir; oda yaşamaya devam eder.
- Oyuncu aynı kullanıcı ile geri bağlanınca (`kizma:rejoin`) state'i geri alır.
- Disconnect olan oyuncunun sırası geldiğinde tur akışı kilitlenmez: v1'de
  sıra o oyuncuda bekler (diğerleri rejoin'i bekler). (İleride otomatik atlama
  eklenebilir — bilinen sınır.)

---

## Sabitler Özeti (engine ile birebir)

```
COLORS_ORDER = ['red', 'blue', 'yellow', 'white']
TOKENS_PER_PLAYER = 4
RING_SIZE = 52
HOME_COLUMN_SIZE = 6
GOAL_POS = 57                 // 52 ring + 6 home -> son indeks 57
START_OFFSET = { red: 0, blue: 13, yellow: 26, white: 39 }
SAFE_GLOBAL = { 0, 8, 13, 21, 26, 34, 39, 47 }
EXIT_YARD_ROLL = 6
EXTRA_TURN_ROLL = 6
MAX_CONSECUTIVE_SIXES = 3
```

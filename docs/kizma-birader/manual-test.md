# Kızma Birader — Manuel Test Senaryoları

Ön koşul: backend + frontend çalışıyor, en az 3–4 farklı kullanıcı hesabı.
(Aynı tarayıcıda farklı sekme yerine farklı kullanıcı önerilir; oyuncu kimliği
socket bazlıdır ama aynı userId çakışmasını önlemek için ayrı hesap idealdir.)

## Engine birim doğrulaması (otomatik yapıldı)
Aşağıdakiler geçici bir node script ile doğrulandı (18/18 passed):
- 4/3 oyunculu initial state, tur sırası `red,blue,yellow,white`.
- Yard'dan çıkış yalnız 6 ile; 6 → ekstra hak.
- Overshoot illegal (`pos+die>57`), tam bitiş (`=57`) legal.
- Capture: güvensiz karede rakip tek taş yard'a döner.
- Blok: rakip 2 taşlı kareye gidilemez.
- Kazanma: 4 taş goal → winner + ended.

## A. Auth yönlendirme
1. Çıkış yapıp `/kizma-birader`'a git → `/login`'e yönlendirilir. ✅

## B. 4 oyunculu tam akış
1. K1 "Oda Oluştur" → oda kodu görünür.
2. K2, K3, K4 kodu girip katılır → oyuncu listesi 4/4.
3. Her oyuncu farklı renk seçer (red/blue/yellow/white). Dolu renk pasif görünür.
4. Renk seçmeden "Hazırım" pasif; renk seçince aktif. Herkes "Hazırım".
5. Host'ta "Başlat" aktif olur (4 hazır) → oyun başlar.
6. Sıra red'te; red zar atar; 6 gelirse evden çıkarır, tekrar atar.
7. Tüm tur döngüsü: red→blue→yellow→white→red.
8. Bir oyuncu rakibin tek taşını güvensiz karede kırar → taş yard'a döner.
9. Güvenli karede (start/yıldız) kırma olmaz.
10. Bir oyuncu 4 taşını da bitirir → kazanan overlay, "Yeni Oyun".

## C. 3 oyunculu akış
1. 3 kullanıcı katılır, 3 farklı renk seçer (örn. red, blue, yellow).
2. Host "Başlat" → kullanılmayan renk (white) **pasif**: board'da white yard/ev
   çizili ama oyuna katılmaz, sıra ona gelmez.
3. Tur döngüsü yalnız aktif 3 rengi döner.

## D. Renk kuralları
1. K2, K1'in seçtiği rengi seçmeye çalışır → renk pasif/seçilemez. ✅
2. Renk seçmeden ready → buton pasif. ✅

## E. Backend doğrulaması
1. DevTools console: `socket.emit('kizma:move', {color:'red',tokenId:0,die:3})`
   sırası/legal olmayan bir hamle → `kizma:error` "Geçersiz hamle".
2. Sırası olmayan oyuncu `kizma:roll` → yok sayılır.

## F. Disconnect / rejoin
1. Oyun sırasında bir sekmeyi yenile → `kizma:rejoin` ile state geri gelir.
2. Diğer oyunculara `kizma:player_left` sonrası tekrar bağlanınca devam.

## G. Mobil / responsive
1. DevTools device toolbar — portrait: board viewport'a sığar, taşlar tıklanır.
2. Landscape (max-height ≤ 500px): header gizlenir, board dikeyde dolar,
   durum/zar/zar-at butonu sağ marjda; board üstüne çakışma yok.
3. Beyaz taş koyu temada görünür (koyu border + parlak nokta).

## Regresyon
- `/tavla`, `/wordle`, `/parolla`, `/games`, `/leaderboard` sayfaları çalışır.
- Tavla socket bağlantısı (default namespace) bozulmadı.

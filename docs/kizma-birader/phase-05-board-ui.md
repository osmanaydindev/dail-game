# Phase 05 — Board UI

## Amaç
Net, tıklanabilir, responsive bir Kızma Birader board'u çizmek. Geçerli hamleler
highlight edilir, zar atma belirgin, tur/zar/renk/kalan taş bilgisi net.

## Değiştirilecek / Oluşturulacak dosyalar
- `apps/frontend/src/components/kizma-birader/KizmaBoard.tsx` (SVG board)
- `apps/frontend/src/components/kizma-birader/KizmaBiraderGame.tsx` (oyun akışı)
- `apps/frontend/src/components/kizma-birader/boardLayout.ts` (hücre koordinatları)

## Tasarım
- **SVG** tabanlı 15×15 grid (canvas yerine — tıklama/highlight kolaylığı + ölçek).
- `boardLayout.ts`: 52 ring hücresi + 4×6 home sütunu + 4 yard slotu için (col,row)
  koordinatları. Global ring indeksi → (x,y) eşlemesi.
- Token = renkli daire; beyaz taş için koyu border + gölge (kontrast).
- Geçerli hamlede: kaynak taş ve/veya hedef hücre highlight (ring/haling).
- Zar: belirgin buton/alan; sonuç büyük gösterilir.
- Üst bilgi şeridi: sıradaki renk, zar, her oyuncunun bitirdiği taş sayısı.
- Kazanan ekranı: overlay + "Yeni Oyun / Odaya Dön".

## Etkileşim
- Sırası gelen oyuncu zar atar → `kizma:roll`.
- phase `moving`: legal taşlar tıklanabilir; tıklayınca `kizma:move`.
- Tek legal hamle varsa otomatik oynanabilir (opsiyonel kolaylık).

## Kabul kriterleri
- `npm run build --workspace=apps/frontend` hatasız.
- Board masaüstünde ortalı ve kare; mobilde viewport'a sığar.
- Geçersiz tıklama hiçbir şey yapmaz; geçerli hamle anında senkron olur.

## Manuel test adımları
- 4 oyuncu ile tam tur: çık, ilerle, kır, eve gir, bitir.
- Highlight yalnızca legal taşlarda görünür.
- Kazanan ekranı 4. taş bitince çıkar.

## Bilinen riskler
- SVG koordinat eşlemesinde ring sırası (saat yönü) hataları → görsel zıplama.
  boardLayout dikkatle test edilmeli.

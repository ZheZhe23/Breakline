# Original illustrated artwork / AFTERHOURS 3

These source PNGs were generated specifically for this game with the image generation tool on 2026-11-13. They are original AI-generated illustrations, not assets copied from another game and not a claim of manual drawing by a human artist. Source metadata and source hashes are retained. Distribution uses locally encoded WebP; no remote art URLs are needed.

- nova.png: adult kickboxer NOVA, 30 full-body key drawings.
- brick.png: adult heavyweight BRICK, 30 full-body key drawings.
- iris.png: adult acrobat IRIS, 30 full-body key drawings.
- crosses.png: six additional chronological punching frames per fighter, 18 drawings.
- stage.png: empty illustrated neon rooftop arena, no crowd.

`python tools/pack-core-art.py` needs Pillow, NumPy and SciPy. It performs technical slicing/packing, not anatomy deformation: identifies each complete connected figure, removes negligible alpha noise and adjacent-cell fragments, anchors each full drawing to a consistent floor, preserves the base illustration's pixel scale, applies one shared scale to the supplemental sheet, and writes padded 336×336 cells in a 2016×2016 atlas. It also extracts portrait crops. A component-based slicer is necessary because the generated source rows are not pixel-perfect aligned; naive grid cropping would cut off feet or include pieces from neighbouring drawings.

Frame layout per fighter: 0–5 straight strike; 6–11 kick; 12–17 rising signature; 18–23 character signature; 24 block; 25 evade; 26 reaction; 27 super charge; 28 aerial super pose; 29 victory; 30–35 secondary hand strike. BRICK's shoulder rush and IRIS's cartwheel are different drawings/choreographies, not scaled copies of NOVA's spin kick.

Runtime draws one whole illustrated frame with a uniform character scale and mirrored facing. It never stretches a limb or assembles a fighter from articulated segments. Atlas identity, bounding boxes and hashes live in core/assets/manifest.json. Source references: exec-a2db202e-28a9-4a82-801e-9cf38885cadd, exec-426ca777-56a6-4cd3-893b-6d953df584d8, exec-df9bb2cb-deaf-4315-8e2e-49c2e1f3ae52, exec-73f69b08-499a-4806-938d-063d8db481cb, exec-86c486fb-467a-4ed9-a1e4-9c4082122b07.

## Дополнение MOTION, 13.11.2026

`motion-bridge.png` — 36 дополнительных целых рисунков (шесть рядов по шесть): по два ряда на NOVA, BRICK и IRIS. Созданы генератором до последнего указания пользователя не использовать платные сервисы; в текущем цикле новых запросов генерации нет. Для каждого героя сохранён единый масштаб всех 12 рисунков и отдельный якорь опоры; стопа регистрируется по исходной стойке, без деформации конечностей. Получаются три отдельных атласа 2016×672. Базовые атласы 3.0 не изменяются. Всего 144 рисунка; рендерер не накладывает две разные позы друг на друга.

Часть сгенерированных траекторий соответствует прямому высокому удару, поэтому название финала IRIS уточнено до «ВЫСОКИЙ УДАР»; обещание отдельной полукруглой техники не сохраняется ценой неверной анимации.

## AIRFLOW 3.7, 15.11.2026

Новые рисунки не создавались. Iris переиспользует целые рисунки 13–17, 19–23, 27–28 в самостоятельных прыжковых и опорных клипах. Целый опорный рисунок может поворачиваться вокруг края ладони с общей жёсткой матрицей; расстояния внутри рисунка неизменны. `CoreFighters.project` применяется и к рендеру, и к точке контакта. Точки опоры для 20/21/22 измерены в исходном атласе; кадр 19 только ставит руку, а не притворяется уже установленной опорой. Новые тесты проверяют край пола, обе ориентации, полный растр за границами экрана, посадку и попадания по реальной alpha. Конечное количество рисунков прежнее — 144; новые комбинации рисунков не выдаются за новые иллюстрации.

## REVOLVE 3.8, 15.11.2026

Количество рисунков прежнее. Супер проходит полный оборот на целых рисунках 14/20 вокруг тазового якоря, поправка ориентации между ними сохраняет ось тела; затем 28 — реальный удар в воздухе, 16/17 — последующая посадка. НРНН использует 19/20/21 для входа в инверсию, 22 с наклоном для активного удара, 20/19/17 для возврата. Это не полная новая прорисовка колеса, поэтому название уточнено до опорного удара в инверсии. Отдельно тестируются полный оборот и фаза контакта, чтобы целая анимация снова не подменялась её последним кадром.

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

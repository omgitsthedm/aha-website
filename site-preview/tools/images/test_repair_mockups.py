"""Regression checks for the native embroidery-mask repair; no generation calls."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('repair', Path(__file__).with_name('repair-mockups.py'))
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


class EmbroideryRepair(unittest.TestCase):
    def test_upper_letters_keep_their_source_thread_color(self):
        # Both front templates have stitches ABOVE the old hard-coded y=1000 cut.
        for ink, color, base, thread in [('black', '#e3b4c6', 235, 10), ('cream', '#184035', 20, 235)]:
            with self.subTest(ink=ink), tempfile.TemporaryDirectory() as folder:
                pixels = np.full((1549, 1015, 4), 255, dtype='uint8')
                pixels[:, :, :3] = base
                pixels[950:980, 300:700, :3] = thread
                source = Path(folder)/'front.png'; Image.fromarray(pixels).save(source)
                canvas, _, report = repair.recolor(source, color, ink, 'front')
                self.assertEqual(report['changedThreadPixels'], 0)
                self.assertGreater(report['protectedUpperThreadPixels'], 1000)
                # Source y=960, x=500 after the exact common display transform.
                result = np.array(canvas)
                self.assertLess(abs(int(result[852, 555, 0])-thread), 2)


if __name__ == '__main__':
    unittest.main()

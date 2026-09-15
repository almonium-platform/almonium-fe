import {expect, test} from '@playwright/test';

test('animates the login background with the configured particle colors', async ({page}) => {
  await page.goto('/auth');

  const canvas = page.locator('#tsparticles canvas');
  await expect(canvas).toBeVisible();

  const initialFrame = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());

  await expect.poll(
    () => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()),
  ).not.toBe(initialFrame);

  const hasColoredPixel = await canvas.evaluate(async (element: HTMLCanvasElement) => {
    const image = new Image();
    image.src = element.toDataURL();
    await image.decode();

    const copy = document.createElement('canvas');
    copy.width = element.width;
    copy.height = element.height;
    const context = copy.getContext('2d');

    if (!context) {
      return false;
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];

      if (alpha > 0 && (red !== green || green !== blue)) {
        return true;
      }
    }

    return false;
  });

  expect(hasColoredPixel).toBe(true);
});

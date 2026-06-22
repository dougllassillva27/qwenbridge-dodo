import { Page, Locator, FrameLocator } from "playwright";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Solves the Baxia slidein captcha inside an iframe or directly on the page.
 */
export async function solveBaxiaCaptcha(page: Page, accountId: string): Promise<boolean> {
  const iframeSelector = 'iframe#baxia-dialog-content, iframe[src*="_____tmd_____/punish"]';
  const sliderSelector = '#nc_1_n1z, .btn_slide';
  const wrapperSelector = '#nc_1_wrapper, .nc_wrapper, .baxia-punish';
  const trackSelector = '#nc_1_n1t, .nc_scale';

  let isIframe = false;
  let locatorContext: Page | FrameLocator = page;

  async function findVisible(loc: Locator): Promise<Locator | null> {
    const count = await loc.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      if (await loc.nth(i).isVisible().catch(() => false)) {
        return loc.nth(i);
      }
    }
    return null;
  }

  // Search for the actual visible captcha elements
  let targetWrapper: Locator | null = await findVisible(page.locator(wrapperSelector));
  let targetSlider: Locator | null = await findVisible(page.locator(sliderSelector));
  let foundMain = !!(targetWrapper || targetSlider);
  let foundIframe = false;

  if (!foundMain) {
    const iframeLocators = page.locator(iframeSelector);
    const iframeCount = await iframeLocators.count().catch(() => 0);
    for (let i = 0; i < iframeCount; i++) {
      if (await iframeLocators.nth(i).isVisible().catch(() => false)) {
        const frameCtx = page.frameLocator(iframeSelector).nth(i);
        targetWrapper = await findVisible(frameCtx.locator(wrapperSelector));
        targetSlider = await findVisible(frameCtx.locator(sliderSelector));
        if (targetWrapper || targetSlider) {
          foundIframe = true;
          isIframe = true;
          locatorContext = frameCtx;
          break;
        }
      }
    }
  }

  if (foundMain) {
    console.log(`[CaptchaResolve] Baxia captcha detected on main document for ${accountId}.`);
  } else if (foundIframe) {
    console.log(`[CaptchaResolve] Baxia captcha iframe detected for ${accountId}.`);
  } else {
    console.log(`[CaptchaResolve] No VISIBLE captcha found for ${accountId} despite trigger.`);
    return false; // No captcha detected
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Refresh locators dynamically to prevent stale elements
      const slider = targetSlider || locatorContext.locator(sliderSelector).first();
      await slider.waitFor({ state: 'visible', timeout: 5000 });

      const wrapper = targetWrapper || locatorContext.locator(wrapperSelector).first();
      await wrapper.waitFor({ state: 'visible', timeout: 5000 });

      const sliderBox = await slider.boundingBox();
      if (!sliderBox) throw new Error('Slider bounding box not found');

      let dragDistance = 260; // Default

      // Tentativas 1 e 2: Abordagem Matemática Rápida e Gratuita
      if (attempt <= 2) {
        console.log(`[CaptchaResolve] Attempt ${attempt}: Using fast math calculation for distance...`);
        const track = locatorContext.locator(trackSelector).first();
        const trackBox = await track.boundingBox().catch(() => null);
        
        if (trackBox) {
          dragDistance = trackBox.width - sliderBox.width;
        }
      } 
      // Tentativa 3: Fallback usando Microserviço ChatGPT Vision do usuário
      else {
        console.log(`[CaptchaResolve] Attempt ${attempt}: Using Vision-based captchaResolve (Microservice)...`);
        
        const buffer = await wrapper.screenshot();
        const base64Image = buffer.toString('base64');

        const response = await fetch('http://localhost:50006/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image, accountId })
        }).catch(() => null);

        if (!response || !response.ok) {
          throw new Error(`Microservice unavailable or returned HTTP ${response?.status}`);
        }

        const result = await response.json().catch(() => null) as any;
        if (!result || !result.success || result.x === undefined) {
          throw new Error(`Microservice failed: ${result?.error || 'No X returned'}`);
        }

        dragDistance = result.x;
        console.log(`[CaptchaResolve] Microservice returned x=${dragDistance}.`);
      }

      console.log(`[CaptchaResolve] Simulating drag for ${dragDistance}px...`);

      const startX = sliderBox.x + sliderBox.width / 2;
      const startY = sliderBox.y + sliderBox.height / 2;
      
      // Move mouse to slider center, hover for a moment
      await page.mouse.move(startX, startY, { steps: 5 });
      await sleep(150 + Math.floor(Math.random() * 150));
      
      // Press down
      await page.mouse.down();
      await sleep(100 + Math.floor(Math.random() * 100));

      // Drag
      const steps = 25;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const progress = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const x = startX + dragDistance * progress + (Math.random() * 2 - 1);
        const y = startY + (Math.random() * 2 - 1);
        await page.mouse.move(x, y, { steps: 2 });
        await sleep(15 + Math.floor(Math.random() * 20));
      }

      await sleep(200 + Math.floor(Math.random() * 200));
      await page.mouse.up();
      await sleep(2000);

      const currentWrapper = targetWrapper || locatorContext.locator(wrapperSelector).first();
      const currentSlider = targetSlider || locatorContext.locator(sliderSelector).first();
      
      const isWrapperGone = !(await currentWrapper.isVisible().catch(() => false));
      const isSliderGone = !(await currentSlider.isVisible().catch(() => false));
      
      if (isWrapperGone || isSliderGone) {
        console.log(`[CaptchaResolve] Captcha solved successfully for ${accountId} (wrapper or slider disappeared).`);
        return true;
      }

      const okElement = locatorContext.locator('.btn_ok, .nc_ok, div#nc-loading-circle').first();
      if (await okElement.isVisible().catch(() => false)) {
        console.log(`[CaptchaResolve] Captcha solved successfully for ${accountId} (OK state detected).`);
        await sleep(1500);
        return true;
      }

      console.warn(`[CaptchaResolve] Attempt ${attempt} failed. Retrying...`);
      await sleep(1000);
    } catch (err: any) {
      console.error(`[CaptchaResolve] Error during attempt ${attempt}:`, err.message);
      await sleep(1000);
    }
  }

  console.error(`[CaptchaResolve] Failed to solve after 3 attempts.`);
  process.stdout.write("\x07"); // beep
  import('child_process').then(({ exec }) => {
    const psCommand = `powershell -Command "
      Add-Type -AssemblyName PresentationCore,PresentationFramework,WindowsBase;
      Add-Type -AssemblyName System.Windows.Forms;
      \\$type = Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);' -Name 'Win32' -Namespace 'Win32Functions' -PassThru;
      \\$processes = Get-Process | Where-Object { \\$_.MainWindowTitle -match 'qwen' -or \\$_.Name -match 'chrome|msedge' };
      foreach (\\$p in \\$processes) {
        \\$hwnd = \\$p.MainWindowHandle;
        if (\\$hwnd -ne [IntPtr]::Zero) {
          \\$null = \\$type::ShowWindowAsync(\\$hwnd, 9);
          \\$null = \\$type::SetForegroundWindow(\\$hwnd);
        }
      }
      [System.Windows.Forms.MessageBox]::Show(\\"Resolva o captcha manualmente para a conta ${accountId}.\\", \\"Captcha Detectado\\");
    "`;
    exec(psCommand, () => {});
  });
  await sleep(25000);
  return false;
}

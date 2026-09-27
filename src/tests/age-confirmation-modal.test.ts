import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "patchright";
import { dismissAgeConfirmationModal } from "../services/playwright.ts";

test("dismissAgeConfirmationModal detects and clicks Continuar on age modal", async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <div class="ant-modal-content">
          <button type="button" aria-label="Close" class="ant-modal-close">
            <span class="ant-modal-close-x" aria-label="Close">
              <span role="img" class="anticon">close</span>
            </span>
          </button>
          <div class="ant-modal-header">
            <div class="ant-modal-title" id="_r_9_">Confirme sua idade para continuar</div>
          </div>
          <div class="ant-modal-body">
            <div class="age-confirmation-desc">Em que ano você nasceu?</div>
            <div class="age-confirmation-year">
              <div class="qwen-chat-v2-dropdown-menu qwen-chat-v2-dropdown-menu-block">
                <div class="qwen-chat-v2-dropdown-menu-trigger">
                  <div class="qwen-chat-v2-dropdown-menu-select qwen-chat-v2-dropdown-menu-select-button qwen-chat-v2-dropdown-menu-select-size-l qwen-chat-v2-dropdown-menu-select-block">
                    <span class="qwen-chat-v2-dropdown-menu-select-label">2000</span>
                    <span class="qwen-chat-v2-dropdown-menu-select-arrow"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="ant-modal-footer">
            <div class="qwen-chat-v2-modal-footer-inner">
              <div class="qwen-chat-v2-modal-footer-extra"></div>
              <div class="qwen-chat-v2-modal-footer-btns">
                <button type="button" class="qwen-chat-v2-btn qwen-chat-v2-btn-plain qwen-chat-v2-btn-m" style="display: none;">
                  <span class="qwen-chat-v2-btn-content">取消</span>
                </button>
                <button id="continue-btn" type="button" class="qwen-chat-v2-btn qwen-chat-v2-btn-black qwen-chat-v2-btn-xl qwen-chat-v2-btn-block">
                  <span class="qwen-chat-v2-btn-content">Continuar</span>
                </button>
              </div>
            </div>
        </div>
      </body>
      </html>
    `;
    await page.setContent(html);

    await page.evaluate(() => {
      (window as any).clicked = false;
      document.getElementById('continue-btn')?.addEventListener('click', () => {
        (window as any).clicked = true;
      });
    });

    const dismissed = await dismissAgeConfirmationModal(page);
    assert.equal(dismissed, true, "Should return true indicating modal was dismissed");

    const wasClicked = await page.evaluate(() => (window as any).clicked);
    assert.equal(wasClicked, true, "The Continuar button should have received a click event");
  } finally {
    await browser.close();
  }
});

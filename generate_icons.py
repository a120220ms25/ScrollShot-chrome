#!/usr/bin/env python3
"""
ScrollShot 圖標生成腳本
使用 Python PIL 生成 Chrome 擴充功能所需的圖標
"""

from PIL import Image, ImageDraw
import os

def create_rounded_rectangle_mask(size, radius):
    """創建圓角矩形遮罩"""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (size-1, size-1)], radius, fill=255)
    return mask

def create_icon(size):
    """創建指定尺寸的圖標"""
    # 創建圖像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 漸層背景（簡化版，使用純色）
    # 使用紫色 #667eea
    bg_color = (102, 126, 234, 255)

    # 繪製圓角矩形背景
    radius = int(size * 0.2)
    draw.rounded_rectangle([(0, 0), (size-1, size-1)], radius, fill=bg_color)

    # 繪製相機圖標
    scale = size / 48.0
    center_x = size // 2
    center_y = size // 2

    # 相機機身（矩形）
    cam_width = int(24 * scale)
    cam_height = int(16 * scale)
    cam_x1 = center_x - cam_width // 2
    cam_y1 = center_y - cam_height // 2
    cam_x2 = center_x + cam_width // 2
    cam_y2 = center_y + cam_height // 2

    line_width = max(2, int(2 * scale))

    # 繪製相機輪廓
    draw.rounded_rectangle(
        [(cam_x1, cam_y1), (cam_x2, cam_y2)],
        int(2 * scale),
        outline=(255, 255, 255, 255),
        width=line_width
    )

    # 繪製鏡頭（圓形）
    lens_radius = int(6 * scale)
    lens_bbox = [
        center_x - lens_radius,
        center_y - lens_radius,
        center_x + lens_radius,
        center_y + lens_radius
    ]
    draw.ellipse(lens_bbox, fill=(255, 255, 255, 255))

    # 繪製閃光燈（小矩形）
    flash_width = int(4 * scale)
    flash_height = int(2 * scale)
    flash_x1 = center_x - int(8 * scale)
    flash_y1 = center_y - int(10 * scale)
    flash_x2 = flash_x1 + flash_width
    flash_y2 = flash_y1 + flash_height

    draw.rectangle(
        [(flash_x1, flash_y1), (flash_x2, flash_y2)],
        fill=(255, 255, 255, 255)
    )

    return img

def main():
    """主函數：生成所有尺寸的圖標"""
    sizes = [16, 32, 48, 128]
    output_dir = 'icons'

    # 確保輸出目錄存在
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print("正在生成 ScrollShot 圖標...")
    print("-" * 50)

    for size in sizes:
        # 創建圖標
        icon = create_icon(size)

        # 保存圖標
        filename = f'{output_dir}/icon{size}.png'
        icon.save(filename, 'PNG')

        file_size = os.path.getsize(filename)
        print(f"✓ 已生成 {filename} ({file_size} bytes)")

    print("-" * 50)
    print("✅ 所有圖標生成完成！")
    print(f"\n圖標已保存到 {output_dir}/ 資料夾")
    print("\n下一步：")
    print("1. 前往 chrome://extensions/")
    print("2. 啟用「開發人員模式」")
    print("3. 點擊「載入未封裝項目」")
    print("4. 選擇此專案資料夾")

if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print("❌ 錯誤：需要安裝 Pillow 套件")
        print("\n請執行以下命令安裝：")
        print("  pip install Pillow")
        print("\n或者使用瀏覽器生成圖標：")
        print("  開啟 icons/generate-icons.html")

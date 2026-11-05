from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

source = Path(r"E:\Image\Ảnh nền máy tính\Web_Photo_Editor.jpg")
output = Path(r"E:\Game hoa cuoc song\public\assets\lobby-reference")
output.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert("RGB")

boxes = {
    "today-character.jpg": (249, 166, 450, 409),
    "boss-art.jpg": (1004, 163, 1240, 412),
    "apartment-art.jpg": (248, 633, 795, 1057),
    "butler-art.jpg": (1507, 113, 1633, 237),
    "reward-headphones.jpg": (1526, 606, 1703, 690),
    "reward-outfit.jpg": (1712, 606, 1894, 690),
    "reward-room.jpg": (1526, 753, 1703, 838),
    "reward-resort.jpg": (1712, 753, 1894, 838),
    "reward-bed.jpg": (1526, 902, 1703, 988),
    "reward-coffee.jpg": (1712, 902, 1894, 988),
}

for name, box in boxes.items():
    image.crop(box).save(output / name, quality=94, subsampling=0)

backdrop = image.filter(ImageFilter.GaussianBlur(20))
backdrop = ImageEnhance.Brightness(backdrop).enhance(0.58)
backdrop.save(output / "city-blur.jpg", quality=84, subsampling=0)
image.crop((132, 500, 231, 990)).save(output / "sidebar-city.jpg", quality=92, subsampling=0)

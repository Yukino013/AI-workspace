import sharp from 'sharp';
import { AppError } from '../utils/AppError.js';

const MAX_PIXELS = 16_000_000;
const MAX_DIMENSION = 8192;

/** 在调用解码器前排除 SVG、文档等其他格式，不信任文件名或声明的 MIME。 */
function imageFormat(input: Buffer): string | undefined {
  if (input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return 'jpeg';
  if (['GIF87a', 'GIF89a'].includes(input.toString('ascii', 0, 6))) return 'gif';
  if (input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return undefined;
}

/** 严格解码首帧并重新编码，不保留原始文件或 EXIF / GPS 等元数据。 */
export async function encodeAvatar(input: Buffer): Promise<Buffer> {
  const format = imageFormat(input);
  if (!format) throw new AppError(400, 40001, '文件内容不是支持的图片');

  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: MAX_PIXELS, page: 0, pages: 1 });
    const metadata = await image.metadata();
    const { width, height } = metadata;
    if (metadata.format !== format || !width || !height) {
      throw new AppError(400, 40001, '文件内容不是支持的图片');
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
      throw new AppError(400, 40001, '图片单边不能超过 8192 像素，且总像素不能超过 1600 万');
    }
    // toBuffer 会实际解码像素；仅 metadata 成功不足以证明文件完整。
    return await image.autoOrient()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    // 解码器可能包含底层细节，对客户端只提供固定提示。
    throw new AppError(400, 40001, '图片损坏或超过 1600 万像素限制，请更换图片');
  }
}

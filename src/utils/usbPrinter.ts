/**
 * Web USB Printer Utility
 * Supports 58mm and 80mm ESC/POS Thermal Printers
 */

import { Transaction, TransactionDetail, Settings } from '../types.js';

let connectedUsbDevice: any = null;
let outEndpointNumber: number | null = null;
let interfaceNumber: number | null = null;

export interface UsbPrinterConnectionStatus {
  connected: boolean;
  deviceName?: string;
  error?: string;
}

/**
 * Check if Web USB is supported
 */
export function isUsbSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.navigator as any).usb;
}

/**
 * Connect to a USB printer
 */
export async function connectUsbPrinter(): Promise<UsbPrinterConnectionStatus> {
  if (!isUsbSupported()) {
    return { connected: false, error: 'Web USB tidak didukung oleh browser Anda. Gunakan Google Chrome atau Microsoft Edge.' };
  }

  try {
    const usb = (window.navigator as any).usb;
    const device = await usb.requestDevice({ filters: [] });
    
    await device.open();
    await device.selectConfiguration(1);

    let printerInterface = null;
    let outEndpoint = null;

    // Iterate configuration interfaces to find a printing interface (Class 7)
    for (const conf of device.configurations) {
      for (const iface of conf.interfaces) {
        for (const alt of iface.alternates) {
          if (alt.interfaceClass === 7) {
            printerInterface = iface;
            for (const ep of alt.endpoints) {
              if (ep.direction === 'out') {
                outEndpoint = ep;
                break;
              }
            }
          }
        }
        if (outEndpoint) break;
      }
      if (outEndpoint) break;
    }

    // Fallback: claim interface 0 or first available
    if (!printerInterface) {
      printerInterface = device.configuration.interfaces[0];
      const alt = printerInterface.alternates[0];
      for (const ep of alt.endpoints) {
        if (ep.direction === 'out') {
          outEndpoint = ep;
          break;
        }
      }
    }

    if (!outEndpoint) {
      await device.close();
      return { connected: false, error: 'Endpoint output USB tidak ditemukan pada printer.' };
    }

    await device.claimInterface(printerInterface.interfaceNumber);

    connectedUsbDevice = device;
    interfaceNumber = printerInterface.interfaceNumber;
    outEndpointNumber = outEndpoint.endpointNumber;

    return {
      connected: true,
      deviceName: device.productName || 'Printer USB',
    };
  } catch (err: any) {
    const isCancelled = err.name === 'NotFoundError' || 
                        err.name === 'AbortError' ||
                        (err.message && (
                          err.message.includes('cancelled') || 
                          err.message.includes('canceled') || 
                          err.message.includes('No device selected') ||
                          err.message.includes('chooser')
                        ));

    if (isCancelled) {
      console.log('USB Printer connection cancelled by user.');
    } else {
      console.error('USB Printer connection error:', err);
    }

    return {
      connected: false,
      error: isCancelled ? undefined : (err.message || 'Gagal menyambungkan ke printer USB.'),
    };
  }
}

/**
 * Disconnect current USB printer
 */
export async function disconnectUsbPrinter(): Promise<void> {
  if (connectedUsbDevice) {
    try {
      if (interfaceNumber !== null) {
        await connectedUsbDevice.releaseInterface(interfaceNumber);
      }
      await connectedUsbDevice.close();
    } catch (e) {
      console.error('Error disconnecting USB printer:', e);
    }
  }
  connectedUsbDevice = null;
  interfaceNumber = null;
  outEndpointNumber = null;
}

/**
 * Get connected USB printer info
 */
export function getConnectedUsbPrinter(): { connected: boolean; name?: string } {
  if (connectedUsbDevice && connectedUsbDevice.opened) {
    return { connected: true, name: connectedUsbDevice.productName || 'Printer USB' };
  }
  return { connected: false };
}

/**
 * Helper to format a table row
 */
function formatRow(left: string, right: string, maxChars: number): Uint8Array {
  const leftLen = left.length;
  const rightLen = right.length;
  let formatted = '';

  if (leftLen + rightLen >= maxChars) {
    formatted = left + '\n' + ' '.repeat(maxChars - rightLen) + right + '\n';
  } else {
    const spaces = maxChars - leftLen - rightLen;
    formatted = left + ' '.repeat(spaces) + right + '\n';
  }

  return new TextEncoder().encode(formatted);
}

/**
 * Generate ESC/POS QR Code bytes
 */
function getQRCodeESC_POS(data: string): Uint8Array {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const len = dataBytes.length + 3; // +3 for pL, pH, cn, fn, m
  const pL = len & 0xFF;
  const pH = (len >> 8) & 0xFF;

  const chunks: Uint8Array[] = [
    // 1. Set QR model (Model 2)
    new Uint8Array([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    // 2. Set QR size (size = 3 or 4)
    new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04]),
    // 3. Set QR error correction level (L = 48)
    new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x44, 0x30]),
    // 4. Store QR data in symbol storage area
    new Uint8Array([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]),
    dataBytes,
    // 5. Print QR symbol
    new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30])
  ];

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Generate ESC/POS CODE39 Barcode bytes
 */
function getBarcodeESC_POS(data: string): Uint8Array {
  const formattedData = data.toUpperCase().replace(/[^A-Z0-9\- \.\$\/\+\%]/g, '');
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(formattedData);
  
  const chunks: Uint8Array[] = [
    new Uint8Array([0x1D, 0x68, 60]), // height (60)
    new Uint8Array([0x1D, 0x77, 2]),  // width (2)
    new Uint8Array([0x1D, 0x48, 2]),  // HRI text below
    new Uint8Array([0x1D, 0x6B, 0x04]), // Format CODE39
    dataBytes,
    new Uint8Array([0x00]) // NULL termination
  ];

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Print receipt using connected Web USB printer
 */
export async function printUsbReceipt(
  tx: Transaction,
  details: TransactionDetail[],
  settings: Settings,
  paperSize: '58' | '80' = '58'
): Promise<{ success: boolean; error?: string }> {
  if (!connectedUsbDevice || outEndpointNumber === null) {
    return { success: false, error: 'Printer USB belum terhubung. Sambungkan printer terlebih dahulu.' };
  }

  try {
    const maxChars = paperSize === '58' ? 32 : 48;
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    // ESC/POS Commands
    const ESC = 0x1B;
    const GS = 0x1D;
    const INIT = new Uint8Array([ESC, 0x40]);
    const CENTER = new Uint8Array([ESC, 0x61, 0x01]);
    const LEFT = new Uint8Array([ESC, 0x61, 0x00]);
    const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
    const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
    
    chunks.push(INIT);

    // 1. Header (Centered)
    chunks.push(CENTER);
    chunks.push(BOLD_ON);
    chunks.push(encoder.encode(settings.namaToko + '\n'));
    chunks.push(BOLD_OFF);
    chunks.push(encoder.encode(settings.alamat + '\n'));
    chunks.push(encoder.encode('Telp: ' + settings.telepon + '\n'));
    chunks.push(LEFT);
    chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));

    // 2. Transaction Info
    chunks.push(formatRow('No: ' + tx.ID_Transaksi, 'Kasir: ' + tx.Kasir, maxChars));
    const tglString = (() => {
      if (!tx.Tanggal) return '-';
      const d = new Date(tx.Tanggal);
      return isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    })();
    chunks.push(formatRow('Tgl: ' + tglString, 'Cust: ' + tx.Nama_Pelanggan, maxChars));
    chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));

    // 3. Items list
    details.forEach((item) => {
      chunks.push(encoder.encode(item.Nama_Menu + '\n'));
      const qtyPrice = `  ${item.Qty} x Rp ${(item.Harga_Satuan || 0).toLocaleString('id-ID')}`;
      const subtotal = `Rp ${(item.Subtotal || 0).toLocaleString('id-ID')}`;
      chunks.push(formatRow(qtyPrice, subtotal, maxChars));
    });

    chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));

    // 4. Totals
    chunks.push(formatRow('Total Item:', String(tx.Total_Item), maxChars));
    
    chunks.push(BOLD_ON);
    chunks.push(formatRow('Grand Total:', `Rp ${(tx.Total_Harga || 0).toLocaleString('id-ID')}`, maxChars));
    chunks.push(BOLD_OFF);
    
    chunks.push(formatRow('Metode Bayar:', tx.Metode_Bayar || 'TUNAI', maxChars));
    chunks.push(formatRow('Bayar:', `Rp ${(tx.Bayar || 0).toLocaleString('id-ID')}`, maxChars));
    chunks.push(formatRow('Kembali:', `Rp ${(tx.Kembali || 0).toLocaleString('id-ID')}`, maxChars));
    chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));

    // 5. QRIS Barcode/QR Code Section
    if (tx.Metode_Bayar === 'QRIS') {
      chunks.push(CENTER);
      chunks.push(encoder.encode('\n--- STRUK QRIS (LUNAS) ---\n'));
      
      const qrisData = settings?.qrisPayload;
      if (qrisData) {
        chunks.push(encoder.encode('Scan QR Owner di bawah:\n\n'));
        try {
          chunks.push(getQRCodeESC_POS(qrisData));
        } catch (e) {
          console.error('Failed to encode QRIS QR code:', e);
        }
      } else {
        chunks.push(encoder.encode('Scan QR di bawah:\n\n'));
        try {
          chunks.push(getQRCodeESC_POS(tx.ID_Transaksi));
        } catch (e) {
          console.error('Failed to encode fallback QR code:', e);
        }
      }
      
      chunks.push(encoder.encode('\n'));
      chunks.push(LEFT);
      chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));
    }

    // 6. Footer (Centered)
    chunks.push(CENTER);
    chunks.push(encoder.encode(settings.pesanFooter + '\n'));
    chunks.push(encoder.encode('support system By PGW\n'));
    
    // 7. Paper Feed & Cut
    chunks.push(new Uint8Array([ESC, 0x64, 0x04])); // Feed 4 lines
    chunks.push(new Uint8Array([GS, 0x56, 0x42, 0x00])); // Cut

    // Combine all chunks to write in manageable blocks to the USB device
    const totalBytesCount = chunks.reduce((acc, c) => acc + c.length, 0);
    const combinedData = new Uint8Array(totalBytesCount);
    let offset = 0;
    for (const chunk of chunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    const USB_CHUNK_SIZE = 64;
    for (let i = 0; i < combinedData.length; i += USB_CHUNK_SIZE) {
      const chunk = combinedData.slice(i, i + USB_CHUNK_SIZE);
      await connectedUsbDevice.transferOut(outEndpointNumber, chunk);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    return { success: true };
  } catch (err: any) {
    console.error('USB receipt printing error:', err);
    return { success: false, error: err.message || 'Gagal mengirim data cetak ke printer USB.' };
  }
}

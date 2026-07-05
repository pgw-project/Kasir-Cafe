/**
 * Bluetooth Printer Utility using Web Bluetooth API
 * Supports 58mm and 80mm ESC/POS Thermal Printers
 */

import { Transaction, TransactionDetail, Settings } from '../types.js';

let connectedDevice: any = null;
let connectedCharacteristic: any = null;

export interface PrinterConnectionStatus {
  connected: boolean;
  deviceName?: string;
  error?: string;
  cancelled?: boolean;
}

// Common Bluetooth BLE Thermal Printer service UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Printer UUID
  '0000e001-0000-1000-8000-00805f9b34fb', // Custom BLE Printer UUID 1
  '0000ff00-0000-1000-8000-00805f9b34fb', // Custom BLE Printer UUID 2 (Rongta / Zjiang)
  '0000ff01-0000-1000-8000-00805f9b34fb', // Custom BLE Printer UUID 3
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip / ISSC Dual-Mode BLE
];

/**
 * Check if the browser supports Web Bluetooth
 */
export function isBluetoothSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.navigator as any).bluetooth;
}

/**
 * Connect to a Bluetooth thermal printer
 */
export async function connectPrinter(): Promise<PrinterConnectionStatus> {
  if (!isBluetoothSupported()) {
    return { connected: false, error: 'Web Bluetooth tidak didukung oleh browser Anda. Gunakan Google Chrome, Microsoft Edge, atau Opera.' };
  }

  try {
    const bluetooth = (window.navigator as any).bluetooth;
    
    // Prompt user to select any bluetooth device
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });

    const server = await device.gatt.connect();
    
    // Discover the primary printing service and write characteristic
    let writeChar: any = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
      } catch (e) {
        // Skip service and try next
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      // If we could not discover characteristics directly, try requested known services
      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeChar = char;
              break;
            }
          }
        } catch (e) {
          // Ignore and continue
        }
        if (writeChar) break;
      }
    }

    if (!writeChar) {
      await device.gatt.disconnect();
      return { connected: false, error: 'Karakteristik penulisan printer (Write Characteristic) tidak ditemukan.' };
    }

    connectedDevice = device;
    connectedCharacteristic = writeChar;

    // Listen to disconnect events
    device.addEventListener('gattserverdisconnected', () => {
      connectedDevice = null;
      connectedCharacteristic = null;
    });

    return {
      connected: true,
      deviceName: device.name || 'Printer Bluetooth',
    };
  } catch (err: any) {
    console.error('Bluetooth connection error:', err);
    
    // Check if the error is due to user cancelling the connection dialog
    const isCancelled = err.name === 'NotFoundError' || 
                        err.name === 'AbortError' ||
                        (err.message && (
                          err.message.includes('cancelled') || 
                          err.message.includes('canceled') || 
                          err.message.includes('User cancelled') ||
                          err.message.includes('chooser')
                        ));

    return {
      connected: false,
      cancelled: isCancelled,
      error: isCancelled ? undefined : (err.message || 'Gagal menyambungkan ke printer Bluetooth.'),
    };
  }
}

/**
 * Disconnect current printer
 */
export async function disconnectPrinter(): Promise<void> {
  if (connectedDevice && connectedDevice.gatt.connected) {
    await connectedDevice.gatt.disconnect();
  }
  connectedDevice = null;
  connectedCharacteristic = null;
}

/**
 * Get currently connected printer info
 */
export function getConnectedPrinter(): { connected: boolean; name?: string } {
  if (connectedDevice && connectedDevice.gatt.connected) {
    return { connected: true, name: connectedDevice.name || 'Printer Bluetooth' };
  }
  return { connected: false };
}

/**
 * Format a line with left and right aligned columns
 */
function formatRow(left: string, right: string, maxChars: number): Uint8Array {
  const leftLen = left.length;
  const rightLen = right.length;
  let formatted = '';

  if (leftLen + rightLen >= maxChars) {
    // Wrap left text or put right text on next line
    formatted = left + '\n' + ' '.repeat(maxChars - rightLen) + right + '\n';
  } else {
    const spaces = maxChars - leftLen - rightLen;
    formatted = left + ' '.repeat(spaces) + right + '\n';
  }

  return new TextEncoder().encode(formatted);
}

/**
 * Print receipt using connected Bluetooth printer
 */
export async function printBluetoothReceipt(
  tx: Transaction,
  details: TransactionDetail[],
  settings: Settings,
  paperSize: '58' | '80' = '58'
): Promise<{ success: boolean; error?: string }> {
  if (!connectedCharacteristic) {
    return { success: false, error: 'Printer Bluetooth belum terhubung. Sambungkan printer terlebih dahulu.' };
  }

  try {
    const maxChars = paperSize === '58' ? 32 : 48;
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    // ESC/POS Commands
    const ESC = 0x1B;
    const GS = 0x1D;
    const INIT = new Uint8Array([ESC, 0x40]); // Initialize
    const CENTER = new Uint8Array([ESC, 0x61, 0x01]); // Align center
    const LEFT = new Uint8Array([ESC, 0x61, 0x00]); // Align left
    const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]); // Bold on
    const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]); // Bold off
    
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
    const tglString = new Date(tx.Tanggal).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    chunks.push(formatRow('Tgl: ' + tglString, 'Cust: ' + tx.Nama_Pelanggan, maxChars));
    chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));

    // 3. Items list
    details.forEach((item) => {
      // Item name (left aligned, bold or regular)
      chunks.push(encoder.encode(item.Nama_Menu + '\n'));
      
      // Quantity and prices (left-right row)
      const qtyPrice = `  ${item.Qty} x Rp ${item.Harga_Satuan.toLocaleString('id-ID')}`;
      const subtotal = `Rp ${item.Subtotal.toLocaleString('id-ID')}`;
      chunks.push(formatRow(qtyPrice, subtotal, maxChars));
    });

    chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));

    // 4. Totals
    chunks.push(formatRow('Total Item:', String(tx.Total_Item), maxChars));
    
    chunks.push(BOLD_ON);
    chunks.push(formatRow('Grand Total:', `Rp ${tx.Total_Harga.toLocaleString('id-ID')}`, maxChars));
    chunks.push(BOLD_OFF);
    
    chunks.push(formatRow('Metode Bayar:', tx.Metode_Bayar || 'TUNAI', maxChars));
    chunks.push(formatRow('Bayar:', `Rp ${tx.Bayar.toLocaleString('id-ID')}`, maxChars));
    chunks.push(formatRow('Kembali:', `Rp ${tx.Kembali.toLocaleString('id-ID')}`, maxChars));
    chunks.push(encoder.encode('-'.repeat(maxChars) + '\n'));

    // 5. Footer (Centered)
    chunks.push(CENTER);
    chunks.push(encoder.encode(settings.pesanFooter + '\n'));
    chunks.push(encoder.encode('support system By PGW\n'));
    
    // 6. Paper Feed & Cut
    // Feed 4 lines of paper
    chunks.push(new Uint8Array([ESC, 0x64, 0x04]));
    // Paper cut (if supported)
    chunks.push(new Uint8Array([GS, 0x56, 0x42, 0x00]));

    // Write all chunks to the printer characteristic
    for (const chunk of chunks) {
      await writeChunked(connectedCharacteristic, chunk);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Printing error:', err);
    return { success: false, error: err.message || 'Gagal mengirim data cetak ke printer.' };
  }
}

/**
 * Write bytes in smaller packets to avoid BLE characteristic buffer overflow
 */
async function writeChunked(characteristic: any, data: Uint8Array): Promise<void> {
  const CHUNK_SIZE = 40; // Small safe chunk size for standard BLE bluetooth printers
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    // Small delay to let the printer process the buffer
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

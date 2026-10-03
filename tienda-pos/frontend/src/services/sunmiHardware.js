let barcodeBuffer = '';
let lastKeyTime = Date.now();
let barcodeListener = null;

const handleKeydown = (e) => {
  if (e.key === 'Enter') {
    if (barcodeBuffer.length >= 3 && (Date.now() - lastKeyTime) < 80) {
      // It's a scanner burst (<80ms since last character)
      e.preventDefault();
      e.stopPropagation();
      if (barcodeListener) barcodeListener(barcodeBuffer.trim());
    }
    barcodeBuffer = '';
  } else if (e.key.length === 1) {
    const now = Date.now();
    if (now - lastKeyTime > 60) {
      barcodeBuffer = ''; // Reset if typed slowly by human hand
    }
    barcodeBuffer += e.key;
    lastKeyTime = now;
  }
};

const sunmiHardware = {
  registerScanner(callback) {
    barcodeListener = callback;
    window.addEventListener('keydown', handleKeydown, true);
  },
  
  unregisterScanner() {
    barcodeListener = null;
    window.removeEventListener('keydown', handleKeydown, true);
  },

  async printReceipt(saleData, storeConfig) {
    const formatReceipt = () => {
      const storeName = storeConfig?.storeName || storeConfig?.name || 'Tienda POS';
      const nit = storeConfig?.nitOrCedula || storeConfig?.nit || '';
      const address = storeConfig?.address || '';
      const phone = storeConfig?.phone || '';
      const ticketNum = saleData.ticketNumber || saleData.id || 'REM-0000';
      const footer = storeConfig?.receiptFooter || '¡Gracias por su compra!';
      const total = Number(saleData.totalAmount ?? saleData.total ?? 0).toLocaleString('es-CO');
      const paid = Number(saleData.amountPaid ?? saleData.paid ?? 0).toLocaleString('es-CO');
      const change = Number(saleData.changeDue ?? saleData.change ?? 0).toLocaleString('es-CO');

      let text = `\n================================\n`;
      text += `       ${storeName}\n`;
      if (nit) text += `       NIT/CC: ${nit}\n`;
      if (address) text += `       Dir: ${address}\n`;
      if (phone) text += `       Tel: ${phone}\n`;
      text += `--------------------------------\n`;
      text += `Tiquete: ${ticketNum}\n`;
      text += `Fecha: ${new Date().toLocaleString('es-CO')}\n`;
      text += `--------------------------------\n`;
      
      const items = saleData.items || [];
      items.forEach(item => {
        const name = item.productName || item.name || 'Producto';
        const qty = item.qty || item.quantity || 1;
        const price = Number(item.unitPrice || item.price || 0).toLocaleString('es-CO');
        const subtotal = Number(item.subtotal || (qty * (item.unitPrice || item.price || 0))).toLocaleString('es-CO');
        text += `${name}\n  ${qty} x $${price} = $${subtotal}\n`;
      });
      
      text += `--------------------------------\n`;
      text += `TOTAL:   $${total}\n`;
      text += `PAGADO:  $${paid}\n`;
      text += `CAMBIO:  $${change}\n`;
      text += `================================\n`;
      text += `  ${footer}\n\n\n`;
      return text;
    };

    const isWails = !!window.go?.main?.App;
    
    if (window.SunmiPrinter) {
      try {
        await window.SunmiPrinter.printText(formatReceipt());
        await window.SunmiPrinter.cutPaper();
      } catch (err) {
        console.error('Sunmi Print error:', err);
      }
    } else if (isWails && window.go?.main?.App?.PrintReceipt) {
      await window.go.main.App.PrintReceipt(saleData, storeConfig);
    } else {
      console.log('Printing Receipt:\n', formatReceipt());
    }
  }
};

export default sunmiHardware;

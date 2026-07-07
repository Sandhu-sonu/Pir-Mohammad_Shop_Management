import { prisma } from '@/db/prisma';
import { jsPDF } from 'jspdf';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.saaSInvoice.findUnique({
      where: { id },
      include: { shop: true }
    });

    if (!invoice) {
      return new Response('Invoice statement not found', { status: 404 });
    }

    const doc = new jsPDF();
    
    // Header section
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("PUNJAB RETAIL MANAGEMENT SYSTEM", 20, 20);
    doc.setFontSize(12);
    doc.text("SaaS Billing Invoice & Receipt / ਰਸੀਦ", 20, 28);
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);

    // Metadata section
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 20, 42);
    doc.text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 20, 48);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, 54);
    doc.text(`Status: ${invoice.status}`, 20, 60);

    doc.text(`Billed To:`, 120, 42);
    doc.setFont("Helvetica", "bold");
    doc.text(invoice.shop.name, 120, 48);
    doc.setFont("Helvetica", "normal");
    doc.text(`Phone: ${invoice.shop.phone || 'N/A'}`, 120, 54);

    // Line items header
    doc.line(20, 68, 190, 68);
    doc.setFont("Helvetica", "bold");
    doc.text("Description", 20, 74);
    doc.text("Amount", 160, 74);
    doc.line(20, 78, 190, 78);

    // Line items content
    doc.setFont("Helvetica", "normal");
    doc.text(invoice.notes || "Subscription Renewals Fee", 20, 88);
    doc.text(`INR ${invoice.subtotal.toString()}`, 160, 88);

    // Summary calculations block
    doc.line(20, 98, 190, 98);
    doc.text("Subtotal:", 120, 106);
    doc.text(`INR ${invoice.subtotal.toString()}`, 160, 106);
    doc.text("Tax (18% GST standard):", 120, 112);
    doc.text(`INR ${invoice.taxAmount.toString()}`, 160, 112);
    
    doc.setFont("Helvetica", "bold");
    doc.text("Total Paid:", 120, 120);
    doc.text(`INR ${invoice.totalAmount.toString()}`, 160, 120);

    // Footer note
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Thank you for using Punjab Retail Management System SaaS Platform!", 20, 140);

    const pdfBuffer = doc.output('arraybuffer');
    
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`
      }
    });
  } catch (err: any) {
    console.error('Invoice PDF generation failure:', err);
    return new Response(`PDF generation failed: ${err.message}`, { status: 500 });
  }
}

import nodemailer from 'nodemailer';

// Use ethereal email for testing by default if no credentials provided
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'eleonore.jacobs@ethereal.email', // Replace with a real one or keep Ethereal for testing
    pass: process.env.SMTP_PASS || 'dE8d5tK2yYh9u3Vb3e'
  }
});

export const sendProviderNotification = async (providerEmail, buyerName, productName) => {
  try {
    const info = await transporter.sendMail({
      from: '"Vortex Marketplace" <noreply@vortex.com>',
      to: providerEmail,
      subject: `New Inquiry Received: ${productName}`,
      text: `Hello,\n\nYou have received a new inquiry from ${buyerName} regarding your product: ${productName}.\n\nPlease log in to your Provider Dashboard to view the details and respond.\n\nBest regards,\nVortex Team`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">New Inquiry Received!</h2>
          <p>Hello,</p>
          <p>You have received a new inquiry from <strong>${buyerName}</strong> regarding your product:</p>
          <div style="background: #f0f4ff; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0;">
            <strong>${productName}</strong>
          </div>
          <p>Please log in to your Provider Dashboard to view the details and respond to the buyer.</p>
          <br/>
          <p>Best regards,<br/><strong>Vortex Team</strong></p>
        </div>
      `
    });

    console.log('Notification email sent to provider:', providerEmail);
    // Log the Ethereal URL where the email can be previewed if using Ethereal
    if (info.messageId && process.env.SMTP_HOST === undefined) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
};

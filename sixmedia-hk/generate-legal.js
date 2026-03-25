const fs = require('fs');

// Read index.html to extract head/style section
const index = fs.readFileSync('index.html', 'utf8');

// Extract everything from <!DOCTYPE> to </style>
const styleMatch = index.match(/<style>([\s\S]*?)<\/style>/);
const style = styleMatch[1];

// Extract nav HTML
const navMatch = index.match(/<nav[\s\S]*?<\/nav>/);
const navHtml = navMatch[0];

const footerLinks = `
      <a href="privacy-policy.html">Privacy Policy</a>
      <a href="terms-of-service.html">Terms of Service</a>
      <a href="aml-policy.html">AML Policy</a>
      <a href="acceptable-use.html">Acceptable Use</a>
      <a href="data-security.html">Data Security</a>
      <a href="complaints.html">Complaints</a>`;

function makePage(title, slug, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Six Media Technology Limited</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230a0f1c'/><text x='3' y='23' font-family='Arial,sans-serif' font-weight='800' font-size='16' fill='%23818cf8'>SM</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: #0a0f1c;
      --primary-light: #141b2d;
      --accent: #6366f1;
      --accent-light: #818cf8;
      --accent-glow: rgba(99, 102, 241, 0.3);
      --light: #f8fafc;
      --text: #1e293b;
      --text-light: #64748b;
      --white: #ffffff;
      --border: #e2e8f0;
    }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: var(--text); line-height: 1.7; background: var(--white); }

    nav { position: fixed; top: 0; width: 100%; z-index: 1000; padding: 0 2rem; background: rgba(10, 15, 28, 0.95); backdrop-filter: blur(20px); box-shadow: 0 4px 30px rgba(0,0,0,0.2); }
    .nav-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; height: 72px; }
    .logo { font-size: 1.6rem; font-weight: 800; color: var(--white); text-decoration: none; letter-spacing: 0.5px; }
    .logo span { color: var(--accent-light); }
    .nav-links { display: flex; gap: 2.5rem; list-style: none; align-items: center; }
    .nav-links a { color: rgba(255,255,255,0.75); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.3s; }
    .nav-links a:hover { color: var(--white); }
    .nav-cta { background: var(--accent) !important; color: var(--white) !important; padding: 8px 20px; border-radius: 8px; font-weight: 600 !important; }
    .nav-cta:hover { background: var(--accent-light) !important; }

    .legal-hero { background: var(--primary); padding: 8rem 2rem 3rem; text-align: center; }
    .legal-hero h1 { color: var(--white); font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; }
    .legal-hero .breadcrumb { color: rgba(255,255,255,0.5); font-size: 0.9rem; }
    .legal-hero .breadcrumb a { color: var(--accent-light); text-decoration: none; }
    .legal-hero .breadcrumb a:hover { color: var(--white); }
    .legal-hero .updated { color: rgba(255,255,255,0.4); font-size: 0.8rem; margin-top: 0.75rem; }

    .legal-content { max-width: 800px; margin: 0 auto; padding: 3rem 2rem 5rem; }
    .legal-content h2 { font-size: 1.4rem; font-weight: 700; color: var(--accent); margin: 2.5rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border); }
    .legal-content h3 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }
    .legal-content p { margin-bottom: 1rem; color: var(--text-light); }
    .legal-content ul, .legal-content ol { margin: 0.5rem 0 1rem 1.5rem; color: var(--text-light); }
    .legal-content li { margin-bottom: 0.4rem; }
    .legal-content strong { color: var(--text); }
    .legal-content a { color: var(--accent); text-decoration: none; }
    .legal-content a:hover { text-decoration: underline; }
    .legal-content .highlight-box { background: var(--light); border-left: 4px solid var(--accent); padding: 1rem 1.5rem; margin: 1.5rem 0; border-radius: 0 8px 8px 0; }

    footer { background: #060a14; padding: 2rem; }
    .footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; color: rgba(255,255,255,0.4); font-size: 0.85rem; }
    footer a { color: var(--accent-light); text-decoration: none; font-size: 0.8rem; }
    footer a:hover { color: var(--white); }
    .footer-links { display: flex; gap: 1.5rem; flex-wrap: wrap; }

    @media (max-width: 768px) {
      .nav-links { display: none; }
      .legal-hero h1 { font-size: 1.8rem; }
      .footer-inner { flex-direction: column; text-align: center; }
      .footer-links { justify-content: center; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="nav-inner">
      <a href="index.html" class="logo">SIX<span>MEDIA</span></a>
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="index.html#services">Services</a></li>
        <li><a href="index.html#about">About</a></li>
        <li><a href="index.html#contact" class="nav-cta">Contact Us</a></li>
      </ul>
    </div>
  </nav>

  <section class="legal-hero">
    <div class="breadcrumb"><a href="index.html">Home</a> &rarr; ${title}</div>
    <h1>${title}</h1>
    <p class="updated">Last updated: March 2026</p>
  </section>

  <div class="legal-content">
${content}
  </div>

  <footer>
    <div class="footer-inner">
      <span>&copy; 2026 Six Media Technology Limited. All rights reserved.</span>
      <div class="footer-links">${footerLinks}
      </div>
    </div>
  </footer>
</body>
</html>`;
}

// 1. Privacy Policy
const privacy = `
    <h2>1. Introduction</h2>
    <p>Six Media Technology Limited ("Company", "we", "us") is committed to protecting the privacy and personal data of our clients, partners, and website visitors. This Privacy Policy explains how we collect, use, disclose, and safeguard your information in accordance with the Hong Kong Personal Data (Privacy) Ordinance (Cap. 486) ("PDPO") and applicable international data protection regulations including the General Data Protection Regulation ("GDPR").</p>
    <div class="highlight-box"><strong>Data Controller:</strong> Six Media Technology Limited, FLAT 2304, 23/F, Ho King Comm Centre, 2-16 Fa Yuen Street, Mong Kok, Hong Kong.<br>Email: <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a></div>

    <h2>2. Information We Collect</h2>
    <h3>2.1 Personal Information</h3>
    <ul>
      <li>Full name, business name, and job title</li>
      <li>Contact details: email address, phone number, postal address</li>
      <li>Business registration documents and identification</li>
      <li>Account login credentials</li>
    </ul>
    <h3>2.2 Financial Information</h3>
    <ul>
      <li>Payment card details (processed through PCI-DSS compliant payment processors)</li>
      <li>Bank account information for wire transfers</li>
      <li>Billing and transaction history</li>
      <li>Advertising spend and budget data</li>
    </ul>
    <h3>2.3 Technical Information</h3>
    <ul>
      <li>IP address and browser type</li>
      <li>Device information and operating system</li>
      <li>Cookies and similar tracking technologies</li>
      <li>Usage data and access logs</li>
    </ul>

    <h2>3. How We Use Your Information</h2>
    <p>We process personal data for the following purposes:</p>
    <ul>
      <li><strong>Service Delivery:</strong> To provide advertising account management, media buying, and campaign management services</li>
      <li><strong>Account Management:</strong> To create and manage your account, process payments, and communicate about our services</li>
      <li><strong>Compliance:</strong> To meet our legal obligations including KYC/AML requirements</li>
      <li><strong>Improvement:</strong> To analyze usage patterns and improve our services</li>
      <li><strong>Communication:</strong> To send service updates, invoices, and marketing communications (with consent)</li>
      <li><strong>Security:</strong> To protect against fraud, unauthorized transactions, and misuse</li>
    </ul>

    <h2>4. Legal Basis for Processing</h2>
    <p>We process personal data based on:</p>
    <ul>
      <li><strong>Contractual necessity:</strong> To fulfill our service agreements</li>
      <li><strong>Legal obligation:</strong> To comply with applicable laws and regulations</li>
      <li><strong>Legitimate interests:</strong> To improve our services, prevent fraud, and ensure security</li>
      <li><strong>Consent:</strong> For marketing communications and non-essential cookies</li>
    </ul>

    <h2>5. Data Sharing & Third Parties</h2>
    <p>We may share your information with:</p>
    <ul>
      <li><strong>Advertising Platforms:</strong> Meta (Facebook), Google, TikTok, Snapchat for campaign execution</li>
      <li><strong>Payment Processors:</strong> Secure PCI-DSS compliant payment service providers</li>
      <li><strong>Cloud Infrastructure:</strong> Hosting and data storage providers with appropriate safeguards</li>
      <li><strong>Professional Advisors:</strong> Lawyers, auditors, and compliance consultants</li>
      <li><strong>Regulatory Authorities:</strong> When required by law or regulation</li>
    </ul>
    <p>We do not sell personal data to third parties. All third-party processors are contractually bound to protect your data.</p>

    <h2>6. International Data Transfers</h2>
    <p>Your data may be transferred to and processed in countries outside Hong Kong. We ensure adequate safeguards are in place, including standard contractual clauses and data processing agreements compliant with applicable data protection laws.</p>

    <h2>7. Data Retention</h2>
    <p>We retain personal data for as long as necessary to fulfill the purposes outlined in this policy, typically:</p>
    <ul>
      <li>Active account data: Duration of business relationship plus 7 years</li>
      <li>Financial records: 7 years (as required by Hong Kong tax legislation)</li>
      <li>Marketing consent records: Until consent is withdrawn</li>
      <li>Website analytics: 26 months</li>
    </ul>

    <h2>8. Your Rights</h2>
    <p>Under the PDPO and GDPR (where applicable), you have the right to:</p>
    <ul>
      <li><strong>Access:</strong> Request a copy of your personal data</li>
      <li><strong>Correction:</strong> Request correction of inaccurate data</li>
      <li><strong>Erasure:</strong> Request deletion of your data (subject to legal obligations)</li>
      <li><strong>Restriction:</strong> Request limitation of processing</li>
      <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
      <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
      <li><strong>Withdraw Consent:</strong> Withdraw consent at any time for consent-based processing</li>
    </ul>
    <p>To exercise your rights, contact us at <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a>. We will respond within 40 days as required by the PDPO.</p>

    <h2>9. Cookies Policy</h2>
    <p>Our website uses cookies and similar technologies:</p>
    <ul>
      <li><strong>Essential Cookies:</strong> Required for website functionality</li>
      <li><strong>Analytics Cookies:</strong> To understand how visitors interact with our website</li>
      <li><strong>Performance Cookies:</strong> To improve website speed and user experience</li>
    </ul>
    <p>You can manage cookie preferences through your browser settings. Disabling certain cookies may limit website functionality.</p>

    <h2>10. Security Measures</h2>
    <p>We implement industry-standard security measures including TLS encryption, firewalls, access controls, and regular security audits to protect your personal data. For more details, see our <a href="data-security.html">Data Security Policy</a>.</p>

    <h2>11. Changes to This Policy</h2>
    <p>We may update this Privacy Policy periodically. Changes will be posted on this page with an updated revision date. Continued use of our services after changes constitutes acceptance of the revised policy.</p>

    <h2>12. Contact Us</h2>
    <div class="highlight-box">
      <strong>Six Media Technology Limited</strong><br>
      FLAT 2304, 23/F, Ho King Comm Centre<br>
      2-16 Fa Yuen Street, Mong Kok, Hong Kong<br><br>
      Email: <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a><br>
      Email: <a href="mailto:mavrickmanixh@gmail.com">mavrickmanixh@gmail.com</a>
    </div>`;

fs.writeFileSync('privacy-policy.html', makePage('Privacy Policy', 'privacy-policy', privacy));
console.log('Created: privacy-policy.html');

// 2. Terms of Service
const terms = `
    <h2>1. Acceptance of Terms</h2>
    <p>By accessing or using the services provided by Six Media Technology Limited ("Company", "we", "us"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, please do not use our services. These Terms constitute a legally binding agreement between you and the Company.</p>

    <h2>2. Services Description</h2>
    <p>Six Media Technology Limited provides digital marketing and advertising technology services including:</p>
    <ul>
      <li>Managed advertising account solutions across major platforms (Meta, Google, TikTok, Snapchat)</li>
      <li>Media buying and campaign management</li>
      <li>Performance marketing consulting</li>
      <li>Ad account provisioning and management</li>
      <li>Advertising spend management and optimization</li>
    </ul>

    <h2>3. Account Registration & Eligibility</h2>
    <p>To use our services, you must:</p>
    <ul>
      <li>Be at least 18 years old and have legal capacity to enter contracts</li>
      <li>Provide accurate, complete, and current registration information</li>
      <li>Maintain the security and confidentiality of your account credentials</li>
      <li>Comply with all applicable advertising platform policies</li>
      <li>Have a legitimate business purpose for the services</li>
    </ul>
    <p>You are responsible for all activities under your account. Notify us immediately of any unauthorized access.</p>

    <h2>4. Payment Terms & Fees</h2>
    <ul>
      <li>Service fees are outlined in your service agreement or as displayed on our platform</li>
      <li>Payments are due upon invoice unless otherwise agreed in writing</li>
      <li>We accept wire transfer, credit card, and other approved payment methods</li>
      <li>All fees are non-refundable unless otherwise stated in your service agreement</li>
      <li>Late payments may incur interest at 1.5% per month or the maximum rate permitted by law</li>
      <li>We reserve the right to suspend services for overdue accounts</li>
    </ul>

    <h2>5. User Obligations</h2>
    <p>You agree to:</p>
    <ul>
      <li>Use services only for lawful purposes and in compliance with all applicable laws</li>
      <li>Not engage in fraudulent, deceptive, or misleading advertising</li>
      <li>Comply with all advertising platform policies (Meta, Google, TikTok, Snapchat)</li>
      <li>Not use services to promote prohibited products or services</li>
      <li>Provide accurate business and billing information</li>
      <li>Cooperate with our compliance and verification procedures</li>
    </ul>

    <h2>6. Intellectual Property</h2>
    <p>All content, trademarks, logos, and software on our platform are the property of Six Media Technology Limited or its licensors. You may not reproduce, distribute, modify, or create derivative works without prior written consent. Client-provided content remains the property of the respective client.</p>

    <h2>7. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law:</p>
    <ul>
      <li>Our total liability for any claim shall not exceed the fees paid by you in the 12 months preceding the claim</li>
      <li>We are not liable for indirect, incidental, special, consequential, or punitive damages</li>
      <li>We are not responsible for third-party platform changes, policy updates, or account suspensions imposed by advertising platforms</li>
      <li>We do not guarantee specific advertising results, returns, or performance metrics</li>
    </ul>

    <h2>8. Indemnification</h2>
    <p>You agree to indemnify, defend, and hold harmless Six Media Technology Limited, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your breach of these Terms, misuse of services, or violation of applicable laws.</p>

    <h2>9. Service Suspension & Termination</h2>
    <ul>
      <li>Either party may terminate with 30 days written notice</li>
      <li>We may immediately suspend or terminate accounts for Terms violations</li>
      <li>Upon termination, outstanding fees remain payable</li>
      <li>We will provide reasonable assistance in transitioning your advertising accounts</li>
    </ul>

    <h2>10. Dispute Resolution</h2>
    <p>Any disputes shall first be attempted to resolve through good faith negotiation. If unresolved within 30 days, disputes shall be submitted to arbitration in Hong Kong under the rules of the Hong Kong International Arbitration Centre (HKIAC).</p>

    <h2>11. Governing Law</h2>
    <p>These Terms are governed by and construed in accordance with the laws of the Hong Kong Special Administrative Region. The courts of Hong Kong shall have exclusive jurisdiction over any disputes arising under these Terms.</p>

    <h2>12. Modifications</h2>
    <p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or platform notification at least 14 days prior to taking effect. Continued use of services constitutes acceptance.</p>

    <h2>13. Contact</h2>
    <div class="highlight-box">
      <strong>Six Media Technology Limited</strong><br>
      FLAT 2304, 23/F, Ho King Comm Centre<br>
      2-16 Fa Yuen Street, Mong Kok, Hong Kong<br><br>
      Email: <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a><br>
      Email: <a href="mailto:mavrickmanixh@gmail.com">mavrickmanixh@gmail.com</a>
    </div>`;

fs.writeFileSync('terms-of-service.html', makePage('Terms of Service', 'terms-of-service', terms));
console.log('Created: terms-of-service.html');

// 3. AML Policy
const aml = `
    <h2>1. Policy Statement</h2>
    <p>Six Media Technology Limited is committed to the highest standards of Anti-Money Laundering ("AML") and Counter-Terrorist Financing ("CTF") compliance. This policy outlines our procedures to prevent the use of our services for money laundering, terrorist financing, or other financial crimes, in accordance with the Anti-Money Laundering and Counter-Terrorist Financing Ordinance (Cap. 615) ("AMLO") of Hong Kong.</p>

    <h2>2. Regulatory Framework</h2>
    <p>Our AML program complies with:</p>
    <ul>
      <li>Hong Kong Anti-Money Laundering and Counter-Terrorist Financing Ordinance (AMLO)</li>
      <li>Drug Trafficking (Recovery of Proceeds) Ordinance (Cap. 405)</li>
      <li>Organized and Serious Crimes Ordinance (Cap. 455)</li>
      <li>United Nations (Anti-Terrorism Measures) Ordinance (Cap. 575)</li>
      <li>Financial Action Task Force (FATF) Recommendations</li>
      <li>Applicable international AML/CTF regulations</li>
    </ul>

    <h2>3. Know Your Customer (KYC) Procedures</h2>
    <h3>3.1 Customer Identification</h3>
    <p>Before establishing a business relationship, we verify:</p>
    <ul>
      <li>Business registration certificate and incorporation documents</li>
      <li>Identity of directors, shareholders, and beneficial owners (>25% ownership)</li>
      <li>Government-issued photo identification for authorized persons</li>
      <li>Proof of business address</li>
      <li>Nature and purpose of the business relationship</li>
    </ul>
    <h3>3.2 Enhanced Due Diligence (EDD)</h3>
    <p>Enhanced measures apply to:</p>
    <ul>
      <li>High-risk jurisdictions identified by FATF</li>
      <li>Politically Exposed Persons (PEPs) and their associates</li>
      <li>Complex ownership structures</li>
      <li>Unusually large or frequent transactions</li>
      <li>Clients from sanctions-listed countries</li>
    </ul>

    <h2>4. Customer Due Diligence (CDD)</h2>
    <p>We conduct ongoing CDD including:</p>
    <ul>
      <li>Regular review and updating of customer information</li>
      <li>Screening against international sanctions lists (UN, OFAC, EU, HK)</li>
      <li>Monitoring transaction patterns for unusual activity</li>
      <li>Risk-based assessment of all business relationships</li>
      <li>Periodic reassessment of customer risk profiles</li>
    </ul>

    <h2>5. Transaction Monitoring</h2>
    <p>We employ systematic monitoring to detect:</p>
    <ul>
      <li>Transactions inconsistent with the customer's known business profile</li>
      <li>Unusual patterns of deposits, withdrawals, or fund transfers</li>
      <li>Transactions involving high-risk jurisdictions</li>
      <li>Structuring or splitting of transactions to avoid thresholds</li>
      <li>Rapid movement of funds with no apparent business purpose</li>
    </ul>

    <h2>6. Suspicious Activity Reporting</h2>
    <p>We maintain robust procedures for reporting suspicious transactions:</p>
    <ul>
      <li>Employees are trained to recognize indicators of money laundering and terrorist financing</li>
      <li>Suspicious Transaction Reports (STRs) are filed with the Joint Financial Intelligence Unit (JFIU) of Hong Kong</li>
      <li>Reports are made promptly and confidentially</li>
      <li>Tipping off is strictly prohibited</li>
    </ul>

    <h2>7. Record Keeping</h2>
    <p>We maintain comprehensive records for a minimum of 6 years including:</p>
    <ul>
      <li>Customer identification and verification documents</li>
      <li>Transaction records and supporting documentation</li>
      <li>Internal and external correspondence relating to CDD</li>
      <li>Risk assessments and monitoring reports</li>
      <li>Staff training records</li>
    </ul>

    <h2>8. Staff Training</h2>
    <p>All relevant employees receive regular AML/CTF training covering:</p>
    <ul>
      <li>Legal obligations and regulatory requirements</li>
      <li>Customer identification and verification procedures</li>
      <li>Recognition of suspicious activities and red flags</li>
      <li>Internal reporting procedures</li>
      <li>Updated typologies and emerging risks</li>
    </ul>

    <h2>9. Compliance Officer</h2>
    <p>Our designated Money Laundering Reporting Officer (MLRO) oversees all AML/CTF activities and can be contacted at <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a>.</p>

    <h2>10. Contact</h2>
    <div class="highlight-box">
      <strong>Compliance Department</strong><br>
      Six Media Technology Limited<br>
      FLAT 2304, 23/F, Ho King Comm Centre<br>
      2-16 Fa Yuen Street, Mong Kok, Hong Kong<br><br>
      Email: <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a>
    </div>`;

fs.writeFileSync('aml-policy.html', makePage('Anti-Money Laundering & KYC Policy', 'aml-policy', aml));
console.log('Created: aml-policy.html');

// 4. Acceptable Use
const aup = `
    <h2>1. Purpose</h2>
    <p>This Acceptable Use Policy ("AUP") defines the permitted and prohibited uses of services provided by Six Media Technology Limited. All clients and users must comply with this policy. Violations may result in immediate suspension or termination of services.</p>

    <h2>2. Permitted Use</h2>
    <p>Our services may be used for:</p>
    <ul>
      <li>Legitimate digital advertising and marketing campaigns</li>
      <li>E-commerce product and service promotion</li>
      <li>Brand awareness and customer acquisition campaigns</li>
      <li>Performance marketing and lead generation</li>
      <li>Advertising account management for lawful businesses</li>
    </ul>

    <h2>3. Prohibited Activities</h2>
    <p>The following activities are strictly prohibited:</p>
    <ul>
      <li>Advertising illegal products, services, or activities</li>
      <li>Promoting counterfeit, pirated, or trademark-infringing goods</li>
      <li>Running deceptive, misleading, or fraudulent advertisements</li>
      <li>Click fraud, bot traffic, or artificial engagement manipulation</li>
      <li>Unauthorized data collection or privacy violations</li>
      <li>Distribution of malware, spyware, or harmful software</li>
      <li>Harassment, hate speech, or discriminatory content</li>
      <li>Any activity designed to circumvent advertising platform policies</li>
      <li>Using our services for money laundering or terrorist financing</li>
    </ul>

    <h2>4. Restricted Industries</h2>
    <p>We do not provide services for the following industries/products:</p>
    <ul>
      <li>Illegal drugs or controlled substances</li>
      <li>Weapons, ammunition, and explosives</li>
      <li>Adult content or services</li>
      <li>Gambling (unless properly licensed in the operating jurisdiction)</li>
      <li>Cryptocurrency and unregistered securities offerings</li>
      <li>Tobacco and vaping products (where prohibited)</li>
      <li>Payday lending and predatory financial services</li>
      <li>Multi-level marketing or pyramid schemes</li>
      <li>Products making unsubstantiated health claims</li>
    </ul>

    <h2>5. Sanctions Compliance</h2>
    <p>Users must not use our services in connection with:</p>
    <ul>
      <li>Individuals or entities on international sanctions lists (UN, OFAC, EU, Hong Kong)</li>
      <li>Countries or territories subject to comprehensive sanctions</li>
      <li>Any transaction that would violate applicable trade restrictions</li>
    </ul>
    <p>We actively screen clients against relevant sanctions databases and reserve the right to refuse or terminate services where sanctions risks are identified.</p>

    <h2>6. Content Guidelines</h2>
    <p>All advertising content must:</p>
    <ul>
      <li>Be truthful, accurate, and not misleading</li>
      <li>Comply with applicable advertising standards and regulations</li>
      <li>Respect intellectual property rights of third parties</li>
      <li>Comply with the advertising policies of the respective platforms</li>
      <li>Not exploit minors or vulnerable populations</li>
    </ul>

    <h2>7. Enforcement</h2>
    <p>Violations of this AUP may result in:</p>
    <ul>
      <li>Written warning and request for remediation</li>
      <li>Temporary suspension of services</li>
      <li>Permanent termination of services without refund</li>
      <li>Reporting to relevant law enforcement or regulatory authorities</li>
    </ul>
    <p>We investigate all reported violations promptly and reserve the right to take immediate action to protect our platform, other clients, and the public.</p>

    <h2>8. Reporting Violations</h2>
    <div class="highlight-box">
      To report a violation of this policy, contact:<br><br>
      Email: <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a><br>
      Email: <a href="mailto:mavrickmanixh@gmail.com">mavrickmanixh@gmail.com</a>
    </div>`;

fs.writeFileSync('acceptable-use.html', makePage('Acceptable Use Policy', 'acceptable-use', aup));
console.log('Created: acceptable-use.html');

// 5. Data Security
const security = `
    <h2>1. Overview</h2>
    <p>Six Media Technology Limited is committed to maintaining the highest standards of data security. This policy outlines the technical and organizational measures we implement to protect client data, financial information, and personal data from unauthorized access, loss, or misuse.</p>

    <h2>2. Encryption & Data Protection</h2>
    <ul>
      <li><strong>In Transit:</strong> All data transmitted between clients and our systems is encrypted using TLS 1.2/1.3</li>
      <li><strong>At Rest:</strong> Sensitive data is encrypted using AES-256 encryption</li>
      <li><strong>Payment Data:</strong> Credit card information is processed through PCI-DSS Level 1 compliant payment processors and is never stored on our servers</li>
      <li><strong>API Communications:</strong> All API endpoints use HTTPS with certificate pinning</li>
    </ul>

    <h2>3. PCI-DSS Compliance</h2>
    <p>We maintain compliance with the Payment Card Industry Data Security Standard (PCI-DSS):</p>
    <ul>
      <li>Payment card data is handled exclusively by certified PCI-DSS Level 1 service providers</li>
      <li>Card numbers are tokenized and never stored in our systems</li>
      <li>Regular PCI compliance assessments are conducted</li>
      <li>Strict access controls for any payment-related systems</li>
    </ul>

    <h2>4. Access Controls</h2>
    <ul>
      <li><strong>Authentication:</strong> Multi-factor authentication (MFA) required for all administrative access</li>
      <li><strong>Role-Based Access:</strong> Employees only access data necessary for their role (principle of least privilege)</li>
      <li><strong>Session Management:</strong> Automatic session expiry and re-authentication for sensitive operations</li>
      <li><strong>Password Policy:</strong> Strong password requirements with regular rotation</li>
      <li><strong>Audit Trails:</strong> Comprehensive logging of all system access and data modifications</li>
    </ul>

    <h2>5. Infrastructure Security</h2>
    <ul>
      <li><strong>Cloud Security:</strong> Hosted on enterprise-grade cloud infrastructure with SOC 2 Type II certification</li>
      <li><strong>Firewalls:</strong> Multi-layered firewall protection with intrusion detection/prevention systems</li>
      <li><strong>DDoS Protection:</strong> Enterprise DDoS mitigation services</li>
      <li><strong>Vulnerability Management:</strong> Regular vulnerability scanning and penetration testing</li>
      <li><strong>Patch Management:</strong> Timely application of security patches and updates</li>
    </ul>

    <h2>6. Monitoring & Detection</h2>
    <ul>
      <li>24/7 security monitoring and alerting</li>
      <li>Real-time threat detection and response</li>
      <li>Automated anomaly detection for unusual access patterns</li>
      <li>Regular review of security logs and audit trails</li>
    </ul>

    <h2>7. Data Breach Response</h2>
    <p>In the event of a data breach, we follow a structured incident response plan:</p>
    <ol>
      <li><strong>Detection & Containment:</strong> Immediate identification and isolation of the affected systems</li>
      <li><strong>Assessment:</strong> Evaluation of the scope, nature, and impact of the breach</li>
      <li><strong>Notification:</strong> Affected individuals and relevant regulatory authorities (including the Privacy Commissioner for Personal Data, Hong Kong) are notified within 72 hours</li>
      <li><strong>Remediation:</strong> Implementation of measures to prevent recurrence</li>
      <li><strong>Post-Incident Review:</strong> Comprehensive analysis and documentation of the incident</li>
    </ol>

    <h2>8. Employee Security</h2>
    <ul>
      <li>Background checks for all employees handling sensitive data</li>
      <li>Mandatory security awareness training upon hire and annually</li>
      <li>Confidentiality agreements and non-disclosure obligations</li>
      <li>Clean desk policy and secure workstation practices</li>
      <li>Immediate access revocation upon employment termination</li>
    </ul>

    <h2>9. Third-Party Security</h2>
    <p>All third-party service providers undergo security assessment including:</p>
    <ul>
      <li>Due diligence review before engagement</li>
      <li>Data processing agreements with security requirements</li>
      <li>Regular compliance verification</li>
      <li>SOC 2 or equivalent certification requirements for critical vendors</li>
    </ul>

    <h2>10. Business Continuity</h2>
    <ul>
      <li>Regular data backups with geographically distributed redundancy</li>
      <li>Disaster recovery plan with defined RPO and RTO objectives</li>
      <li>Annual business continuity testing and drills</li>
    </ul>

    <h2>11. Contact</h2>
    <div class="highlight-box">
      For security concerns or to report a vulnerability:<br><br>
      <strong>Security Team</strong><br>
      Email: <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a>
    </div>`;

fs.writeFileSync('data-security.html', makePage('Data Security & Protection', 'data-security', security));
console.log('Created: data-security.html');

// 6. Complaints
const complaints = `
    <h2>1. Our Commitment</h2>
    <p>Six Media Technology Limited is committed to providing excellent service. We take all complaints seriously and aim to resolve issues fairly, promptly, and transparently. This policy outlines how you can raise a complaint and the process we follow to address it.</p>

    <h2>2. How to File a Complaint</h2>
    <p>You may submit a complaint through any of the following channels:</p>
    <div class="highlight-box">
      <strong>Email:</strong> <a href="mailto:info@sixmedia.hk">info@sixmedia.hk</a> or <a href="mailto:mavrickmanixh@gmail.com">mavrickmanixh@gmail.com</a><br><br>
      <strong>Mail:</strong> Complaints Department<br>
      Six Media Technology Limited<br>
      FLAT 2304, 23/F, Ho King Comm Centre<br>
      2-16 Fa Yuen Street, Mong Kok, Hong Kong
    </div>
    <p>When filing a complaint, please include:</p>
    <ul>
      <li>Your full name and contact details</li>
      <li>Account or reference number (if applicable)</li>
      <li>Detailed description of the issue</li>
      <li>Dates and any relevant documentation</li>
      <li>Your desired resolution</li>
    </ul>

    <h2>3. Acknowledgement</h2>
    <p>We will acknowledge receipt of your complaint within <strong>2 business days</strong> via email, providing you with a unique reference number for tracking purposes.</p>

    <h2>4. Investigation Process</h2>
    <p>Our complaint resolution process follows these steps:</p>
    <ol>
      <li><strong>Receipt & Logging:</strong> Your complaint is logged in our system and assigned to a dedicated case handler</li>
      <li><strong>Initial Review:</strong> The case handler reviews all details and may contact you for additional information</li>
      <li><strong>Investigation:</strong> A thorough investigation is conducted, including review of relevant records, communications, and system logs</li>
      <li><strong>Resolution:</strong> A fair and appropriate resolution is determined based on the findings</li>
      <li><strong>Communication:</strong> You are informed of the outcome with a clear explanation</li>
    </ol>

    <h2>5. Response Timeline</h2>
    <ul>
      <li><strong>Acknowledgement:</strong> Within 2 business days</li>
      <li><strong>Initial Response:</strong> Within 5 business days</li>
      <li><strong>Full Resolution:</strong> Within 15 business days for standard complaints</li>
      <li><strong>Complex Cases:</strong> Within 30 business days (you will be notified of the extended timeline)</li>
    </ul>

    <h2>6. Escalation Process</h2>
    <p>If you are not satisfied with the initial resolution:</p>
    <ol>
      <li><strong>Level 1 — Case Handler:</strong> Your assigned case handler provides the initial resolution</li>
      <li><strong>Level 2 — Senior Management:</strong> If unsatisfied, request escalation to a senior manager who will review the case independently within 10 business days</li>
      <li><strong>Level 3 — Director Review:</strong> If still unresolved, the complaint is escalated to a company director for final internal review within 15 business days</li>
    </ol>

    <h2>7. External Resolution</h2>
    <p>If you remain dissatisfied after exhausting our internal process, you may contact:</p>
    <ul>
      <li><strong>Office of the Privacy Commissioner for Personal Data, Hong Kong</strong> — For data privacy related complaints</li>
      <li><strong>Hong Kong Consumer Council</strong> — For consumer-related disputes</li>
      <li><strong>Hong Kong International Arbitration Centre (HKIAC)</strong> — For contractual disputes</li>
    </ul>

    <h2>8. Record Keeping</h2>
    <p>We maintain records of all complaints for a minimum of 6 years, including the nature of the complaint, investigation findings, resolution, and any follow-up actions taken. This data is used to identify trends and improve our services.</p>

    <h2>9. Continuous Improvement</h2>
    <p>We regularly review complaint data to identify systemic issues and implement improvements. Complaint trends are reported to senior management quarterly to ensure ongoing service quality.</p>`;

fs.writeFileSync('complaints.html', makePage('Complaint Resolution Policy', 'complaints', complaints));
console.log('Created: complaints.html');

console.log('\\nAll 6 legal pages created successfully!');

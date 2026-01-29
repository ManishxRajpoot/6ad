'use client'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-[#1E293B] mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: January 29, 2025</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">1. Introduction</h2>
            <p className="text-gray-600 leading-relaxed">
              Welcome to 6AD ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our advertising management platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">2. Information We Collect</h2>
            <p className="text-gray-600 leading-relaxed mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Account information (name, email address, password)</li>
              <li>Profile information (phone number, address, business details)</li>
              <li>Payment and billing information</li>
              <li>Facebook and other social media account connections</li>
              <li>Advertising account data and campaign information</li>
              <li>Communications with our support team</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-600 leading-relaxed mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and manage your advertising accounts</li>
              <li>Connect to third-party advertising platforms on your behalf</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent transactions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">4. Information Sharing</h2>
            <p className="text-gray-600 leading-relaxed">
              We do not sell, trade, or otherwise transfer your personal information to outside parties except as described in this policy. We may share your information with third-party service providers who assist us in operating our platform, conducting our business, or servicing you, so long as those parties agree to keep this information confidential.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">5. Third-Party Integrations</h2>
            <p className="text-gray-600 leading-relaxed">
              Our platform integrates with third-party services including Facebook, Google, TikTok, and other advertising platforms. When you connect these accounts, we access your advertising data in accordance with the permissions you grant. Please review the privacy policies of these third-party services for information about their data practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">6. Data Security</h2>
            <p className="text-gray-600 leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">7. Data Retention</h2>
            <p className="text-gray-600 leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide you services. We will retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">8. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Rectify or update your personal information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to processing of your personal data</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">9. Cookies</h2>
            <p className="text-gray-600 leading-relaxed">
              We use cookies and similar tracking technologies to track activity on our platform and hold certain information. Cookies are files with small amount of data which may include an anonymous unique identifier.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">10. Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#1E293B] mb-4">11. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-gray-600 mt-2">
              Email: support@6ad.com<br />
              Address: 6AD Platform
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

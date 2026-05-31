/**
 * Word Document Creator - Generate .docx files for motivation letters
 * Uses docx library for professional formatting
 */

const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, UnderlineType } = require('docx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WordDocumentCreator {
    constructor() {
        this.docsDir = path.join(process.cwd(), 'tmp', 'documents');

        // Ensure docs directory exists
        if (!fs.existsSync(this.docsDir)) {
            fs.mkdirSync(this.docsDir, { recursive: true });
        }
    }

    /**
     * Create motivation letter as Word document
     * @param {string} letterContent - Letter text
     * @param {Object} job - Job object
     * @param {Object} profile - Profile object
     * @param {Object} match - Match analysis
     * @returns {Promise<Object>} {filepath, filename, token}
     */
    async createLetterDocument(letterContent, job, profile, match) {
        try {
            console.log('[WordDocumentCreator] Creating letter document for:', job.title);

            // Generate document token
            const token = crypto.randomBytes(16).toString('hex');
            const timestamp = new Date().getTime();
            const filename = `Lettre_Motivation_${token.substring(0, 8)}.docx`;
            const filepath = path.join(this.docsDir, filename);

            // Split letter into sections
            const sections = letterContent.split('\n\n').filter(s => s.trim());

            // Build document sections
            const docSections = [];

            // Add header
            docSections.push(
                new Paragraph({
                    text: profile.name.toUpperCase(),
                    bold: true,
                    size: 28,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 }
                }),
                new Paragraph({
                    text: profile.title,
                    size: 22,
                    alignment: AlignmentType.CENTER,
                    color: '666666',
                    spacing: { after: 200 }
                })
            );

            // Add contact info
            docSections.push(
                new Paragraph({
                    text: `${profile.location} • ✉ syebadokpo@gmail.com • ☎ +229 01 96 91 13 46`,
                    size: 20,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                })
            );

            // Add job info (small, subtle)
            docSections.push(
                new Paragraph({
                    text: `Candidature pour: ${job.title} - ${job.company}`,
                    size: 20,
                    italics: true,
                    color: '999999',
                    spacing: { after: 400 }
                })
            );

            // Add date
            const date = new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            docSections.push(
                new Paragraph({
                    text: date,
                    size: 20,
                    spacing: { after: 400 }
                })
            );

            // Add letter body
            for (const section of sections) {
                docSections.push(
                    new Paragraph({
                        text: section.trim(),
                        size: 22, // 11pt
                        spacing: { after: 200 },
                        alignment: AlignmentType.JUSTIFIED,
                        lineSpacing: 360 // 1.5 spacing
                    })
                );
            }

            // Add footer with metadata
            docSections.push(
                new Paragraph({
                    text: '',
                    spacing: { after: 200 }
                })
            );

            docSections.push(
                new Paragraph({
                    text: `_____________________________________`,
                    spacing: { after: 100 }
                })
            );

            docSections.push(
                new Paragraph({
                    text: `Pertinence avec l'offre: ${match.fitPercentage}% • Généré le ${new Date().toISOString().split('T')[0]}`,
                    size: 18,
                    italics: true,
                    color: 'CCCCCC',
                    alignment: AlignmentType.CENTER
                })
            );

            // Create document
            const doc = new Document({
                sections: [{
                    children: docSections
                }]
            });

            // Write to file
            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(filepath, buffer);

            console.log('[WordDocumentCreator] ✅ Document created:', filename);

            return {
                filepath: filepath,
                filename: filename,
                token: token,
                size: buffer.length,
                created: new Date().toISOString()
            };

        } catch (error) {
            console.error('[WordDocumentCreator] Error:', error.message);
            throw error;
        }
    }

    /**
     * Create CV document (bonus feature)
     * @param {Object} profile - Profile object
     * @returns {Promise<Object>} {filepath, filename, token}
     */
    async createCVDocument(profile) {
        try {
            console.log('[WordDocumentCreator] Creating CV document');

            const token = crypto.randomBytes(16).toString('hex');
            const filename = `CV_${token.substring(0, 8)}.docx`;
            const filepath = path.join(this.docsDir, filename);

            const docSections = [
                // Header
                new Paragraph({
                    text: profile.name.toUpperCase(),
                    bold: true,
                    size: 28,
                    alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                    text: profile.title,
                    size: 22,
                    alignment: AlignmentType.CENTER,
                    color: '666666',
                    spacing: { after: 200 }
                }),

                // Contact
                new Paragraph({
                    text: `${profile.location} • +229 01 96 91 13 46 • syebadokpo@gmail.com`,
                    size: 20,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),

                // Experience
                new Paragraph({
                    text: 'EXPÉRIENCE PROFESSIONNELLE',
                    bold: true,
                    size: 24,
                    color: '1F4788',
                    spacing: { after: 200 }
                })
            ];

            // Add experiences
            profile.experience_details.forEach(exp => {
                docSections.push(
                    new Paragraph({
                        text: `${exp.title} - ${exp.company}`,
                        bold: true,
                        size: 22,
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        text: exp.duration,
                        italics: true,
                        size: 20,
                        color: '666666',
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        text: exp.highlights,
                        size: 20,
                        spacing: { after: 200 }
                    })
                );
            });

            // Skills section
            docSections.push(
                new Paragraph({
                    text: 'COMPÉTENCES',
                    bold: true,
                    size: 24,
                    color: '1F4788',
                    spacing: { after: 200 }
                })
            );

            const skillsText = [
                `Langages: ${Object.keys(profile.skills.languages).join(', ')}`,
                `Frameworks: ${Object.keys(profile.skills.frameworks).join(', ')}`,
                `Bases de données: ${Object.keys(profile.skills.databases).join(', ')}`,
                `Outils: ${Object.keys(profile.skills.tools).join(', ')}`
            ];

            skillsText.forEach(skill => {
                docSections.push(
                    new Paragraph({
                        text: skill,
                        size: 20,
                        spacing: { after: 100 }
                    })
                );
            });

            // Create and save document
            const doc = new Document({ sections: [{ children: docSections }] });
            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(filepath, buffer);

            console.log('[WordDocumentCreator] ✅ CV created:', filename);

            return {
                filepath: filepath,
                filename: filename,
                token: token,
                size: buffer.length
            };

        } catch (error) {
            console.error('[WordDocumentCreator] CV error:', error.message);
            throw error;
        }
    }

    /**
     * Get document for download
     * @param {string} token - Document token
     * @returns {Object} Document metadata or null
     */
    getDocument(token) {
        try {
            // Search for file with this token
            const files = fs.readdirSync(this.docsDir);
            const file = files.find(f => f.includes(token));

            if (!file) return null;

            const filepath = path.join(this.docsDir, file);
            const stats = fs.statSync(filepath);

            return {
                filepath: filepath,
                filename: file,
                size: stats.size,
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            };

        } catch (error) {
            console.error('[WordDocumentCreator] Get document error:', error.message);
            return null;
        }
    }

    /**
     * Cleanup old documents (older than 24 hours)
     */
    cleanup() {
        try {
            const files = fs.readdirSync(this.docsDir);
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;

            let deleted = 0;

            files.forEach(file => {
                const filepath = path.join(this.docsDir, file);
                const stats = fs.statSync(filepath);

                if (now - stats.mtimeMs > oneDayMs) {
                    fs.unlinkSync(filepath);
                    deleted++;
                }
            });

            if (deleted > 0) {
                console.log(`[WordDocumentCreator] Cleanup: Deleted ${deleted} old documents`);
            }

        } catch (error) {
            console.error('[WordDocumentCreator] Cleanup error:', error.message);
        }
    }

    /**
     * Get documents directory stats
     * @returns {Object} Stats
     */
    getStats() {
        try {
            const files = fs.readdirSync(this.docsDir);
            let totalSize = 0;

            files.forEach(file => {
                const filepath = path.join(this.docsDir, file);
                const stats = fs.statSync(filepath);
                totalSize += stats.size;
            });

            return {
                count: files.length,
                totalSizeMB: Math.round(totalSize / (1024 * 1024)),
                docsDir: this.docsDir
            };

        } catch (error) {
            console.error('[WordDocumentCreator] Stats error:', error.message);
            return { count: 0, totalSizeMB: 0 };
        }
    }
}

// Singleton instance
const wordDocumentCreatorInstance = new WordDocumentCreator();

// Cleanup every 1 hour
setInterval(() => {
    wordDocumentCreatorInstance.cleanup();
}, 60 * 60 * 1000);

module.exports = wordDocumentCreatorInstance;

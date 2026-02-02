// =============================================================================
// DiBeliin Admin - AI Service
// =============================================================================
// Service for analyzing receipt images using Google Gemini AI

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TransactionType } from '@/types/database';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ReceiptAnalysisResult {
    type: TransactionType;
    amount: number;
    date: string;
    description: string;
    category: string;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Analyze this receipt screenshot.

Identify:
- type: "income" or "expense" (Income: DANA, QRIS, Transfer received. Expense: Kopi Kenangan, Fore, GoFood, etc.)
- amount: Total amount as a number in IDR
- date: Date in format YYYY-MM-DD (use today if not found)
- description: Short description in Indonesian (e.g., "Terima DANA dari..." or "Beli Kopi Kenangan...")
- category: One of these values:
  - Income: "penjualan", "jasa", or "lain"
  - Expense: "beli_akun", "server", "operasional", "marketing", or "lain"

CRITICAL: Return ONLY a raw JSON string. Do NOT use Markdown code blocks. Do NOT add any text before or after the JSON.
Example format: {"type":"expense","amount":15000,"date":"2023-10-01","description":"Beli Kopi Kenangan","category":"operasional"}`;

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Convert a File object to a Base64 data string
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Get MIME type from File
 */
function getMimeType(file: File): string {
    return file.type || 'image/jpeg';
}

/**
 * Get today's date in ISO format
 */
function getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Extract and sanitize JSON from AI response text
 * Handles markdown code blocks, extra text, and whitespace
 */
function extractJSON(text: string): string {
    // Remove markdown code fences
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Find the JSON object boundaries
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('No valid JSON object found in response');
    }

    return cleaned.substring(firstBrace, lastBrace + 1);
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Analyze a receipt image using Google Gemini AI
 * @param imageFile - The image file to analyze
 * @returns Analysis result with type, amount, date, description, and category
 * @throws Error if API key is missing, AI cannot read the image, or network error
 */
export async function analyzeReceipt(imageFile: File): Promise<ReceiptAnalysisResult> {
    // Check API key
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API Key tidak dikonfigurasi. Tambahkan VITE_GEMINI_API_KEY ke file .env');
    }

    // Convert file to base64
    const base64Data = await fileToBase64(imageFile);
    const mimeType = getMimeType(imageFile);

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Prepare the prompt with today's date context
    const today = getTodayISO();
    const promptWithDate = `${SYSTEM_PROMPT}\n\nToday's date is: ${today}`;

    try {
        // Call Gemini API
        const result = await model.generateContent([
            promptWithDate,
            {
                inlineData: {
                    mimeType,
                    data: base64Data,
                },
            },
        ]);

        const response = await result.response;
        const rawText = response.text();

        // Debug logging
        console.log('Raw AI Response:', rawText);

        // Extract and parse JSON
        let parsed: Record<string, unknown>;
        try {
            const cleanJson = extractJSON(rawText);
            console.log('Cleaned JSON:', cleanJson);
            parsed = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error('JSON Parse Error. Raw text was:', rawText);
            throw new Error('AI tidak bisa membaca gambar ini. Coba gambar bukti transaksi yang lebih jelas.');
        }

        // Apply fallback values and build result
        const transactionType = (parsed.type === 'income' || parsed.type === 'expense')
            ? parsed.type as TransactionType
            : 'expense';

        const amount = typeof parsed.amount === 'number' && parsed.amount > 0
            ? parsed.amount
            : typeof parsed.amount === 'string'
                ? Math.max(0, Number(parsed.amount.replace(/[^0-9.-]/g, '')))
                : 0;

        const date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? parsed.date
            : today;

        const description = typeof parsed.description === 'string' && parsed.description.trim()
            ? parsed.description.trim()
            : 'Transaksi dari scan AI';

        const validCategories = ['penjualan', 'jasa', 'lain', 'beli_akun', 'server', 'operasional', 'marketing'];
        const category = typeof parsed.category === 'string' && validCategories.includes(parsed.category)
            ? parsed.category
            : transactionType === 'income' ? 'lain' : 'operasional';

        // Warn if amount is 0 (likely failed to extract)
        if (amount === 0) {
            console.warn('Warning: Amount extracted as 0, may need manual correction');
        }

        return {
            type: transactionType,
            amount,
            date,
            description,
            category,
        };
    } catch (error) {
        // Re-throw our custom errors
        if (error instanceof Error && error.message.startsWith('AI')) {
            throw error;
        }
        // Handle network/API errors
        console.error('Gemini API error:', error);
        throw new Error('Gagal menghubungi AI. Periksa koneksi internet Anda.');
    }
}

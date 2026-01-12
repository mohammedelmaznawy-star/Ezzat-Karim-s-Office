
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const summarizeComplaint = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بصفتك مساعداً تقنياً في مكتب النائب، لخص هذه الشكوى في جملة واحدة موجزة جداً ومباشرة توضح جوهر المطلب للنائب.\n\nالشكوى: ${text}`,
    });
    return response.text || "فشل التلخيص";
  } catch (error) {
    return "خطأ في التلخيص التلقائي";
  }
};

export const generateAutoWelcome = async (citizenName: string, complaintTitle: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `صغ رسالة ترحيب قصيرة ومباشرة جداً للمواطن ${citizenName} بشأن شكواه '${complaintTitle}'، مع تأكيد استلامها واهتمام النائب عزت كريم. اجعلها موجزة وودودة.`,
    });
    return response.text || "تم استلام شكواكم بنجاح.";
  } catch (error) {
    return "شكراً لتواصلك معنا، تم استلام شكواك.";
  }
};

export const refineResponseProfessionally = async (draft: string, context: { citizenName: string, complaintTitle: string, complaintDesc: string }): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بصفتك مساعداً رسمياً لمكتب النائب عزت كريم، قم بصياغة رد نهائي شديد الإيجاز والتركيز، بناءً على مسودة الموظف. يجب أن يكون الرد رسمياً، يخاطب المواطن ${context.citizenName} بخصوص '${context.complaintTitle}'، ويحتوي فقط على المعلومة الأساسية للرد دون إسهاب، مع ختم مهذب. مسودة الموظف: ${draft}`,
    });
    return response.text || draft;
  } catch (error) {
    return draft;
  }
};

export const extractIdData = async (base64Image: string): Promise<{ fullName?: string; nationalId?: string; address?: string } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "استخرج الاسم الكامل، رقم البطاقة، والعنوان من البطاقة المصرية. أرجع النتيجة JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            nationalId: { type: Type.STRING },
            address: { type: Type.STRING },
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    return null;
  }
};
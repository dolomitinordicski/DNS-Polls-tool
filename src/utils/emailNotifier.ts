import { Poll, VoteStatus } from '../types';
import { formatDate } from './dateUtils';

const MANAGEMENT_EMAIL = 'management@dolomitinordicski.com';

export interface EmailNotificationResult {
  success: boolean;
  message?: string;
  mailtoUrl?: string;
}

/**
 * Format votes summary as readable text
 */
function formatVotesSummary(poll: Poll, votes: Record<string, VoteStatus>): string {
  return poll.slots.map(s => {
    const dInfo = formatDate(s.date, 'it');
    const status = votes[s.id] || 'no';
    const statusText = status === 'yes' ? 'SÌ ✓' : status === 'maybe' ? 'SE NECESSARIO ❓' : 'NO ✕';
    return `• ${dInfo.weekday} ${dInfo.dayMonth} (${s.time || 'Tutto il giorno'}): ${statusText}`;
  }).join('\n');
}

/**
 * Sends a live email notification to management@dolomitinordicski.com
 * when a participant votes or updates preferences.
 */
export async function sendParticipantVoteNotification(
  poll: Poll,
  participantName: string,
  votes: Record<string, VoteStatus>,
  isUpdate: boolean = false
): Promise<EmailNotificationResult> {
  const subject = `[DNS Polls] ${isUpdate ? 'Aggiornamento' : 'Nuova'} risposta da ${participantName} - "${poll.title}"`;
  const votesFormatted = formatVotesSummary(poll, votes);
  const nowStr = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

  const messageText = `
NUOVA RISPOSTA RICEVUTA SUL SONDAGGIO DNS POLLS
==================================================

Sondaggio: ${poll.title}
Organizzatore: ${poll.organizerName} ${poll.organizerEmail ? `(${poll.organizerEmail})` : ''}
Luogo / Sede: ${poll.location || 'Non specificato'}

Partecipante: ${participantName}
Azione: ${isUpdate ? 'Modifica risposte esistenti' : 'Nuovo inserimento'}
Data/Ora invio: ${nowStr}

DISPONIBILITÀ ESPRESSE:
--------------------------------------------------
${votesFormatted}

--------------------------------------------------
Notifica automatica generata da Dolomiti NordicSki Polls App.
Inviato a: ${MANAGEMENT_EMAIL}
`.trim();

  // Create mailto fallback URL
  const mailtoUrl = `mailto:${MANAGEMENT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageText)}`;

  try {
    // Attempt automatic background dispatch via Formsubmit AJAX
    const response = await fetch(`https://formsubmit.co/ajax/${MANAGEMENT_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        Sondaggio: poll.title,
        Organizzatore: poll.organizerName,
        Partecipante: participantName,
        Stato: isUpdate ? 'Aggiornato' : 'Nuovo',
        DataInvio: nowStr,
        Disponibilita: votesFormatted,
        messaggio: messageText
      })
    });

    if (response.ok) {
      return {
        success: true,
        message: `Notifica email inviata con successo a ${MANAGEMENT_EMAIL}`,
        mailtoUrl
      };
    } else {
      console.warn('Formsubmit notification non-200 response, providing mailto fallback.');
      return {
        success: false,
        message: `Invio automatico via server non riuscito. Puoi inviare via client mail.`,
        mailtoUrl
      };
    }
  } catch (error) {
    console.error('Error sending email notification:', error);
    return {
      success: false,
      message: `Impossibile inviare la notifica server.`,
      mailtoUrl
    };
  }
}

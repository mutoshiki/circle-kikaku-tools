export function applicantIdentity(room, responseKey, applicant, applicants) {
  const mappedId = String(room.meta?.applicantParticipantIds?.[responseKey] || '');
  if (mappedId) return {
    id: room.participants?.[mappedId] && !room.participantTombstones?.[mappedId] ? mappedId : '',
    mappedId,
    deleted: Boolean(room.participantTombstones?.[mappedId]),
  };
  const id = applicants.participantIdForApplicant(room, applicant);
  return { id, mappedId: id, deleted: false };
}

export function rememberApplicantIdentity(room, responseKey, participantId) {
  if (!responseKey || !participantId) return;
  room.meta ||= {};
  room.meta.applicantParticipantIds ||= {};
  room.meta.applicantParticipantIds[responseKey] = participantId;
}

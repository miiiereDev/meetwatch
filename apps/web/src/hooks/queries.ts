import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: api.listSessions,
    refetchInterval: 30_000,
  });
}

export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.getSession(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 30_000,
  });
}

export function useRoster() {
  return useQuery({ queryKey: ['roster'], queryFn: api.listStudents });
}

export function useMappings() {
  return useQuery({ queryKey: ['mappings'], queryFn: api.listMappings });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
}

export function useCreateMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createMapping,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mappings'] });
      void qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useDeleteMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteMapping,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mappings'] });
      void qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data);
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSession,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.endSession,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      void qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useRosterMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['roster'] });
  const create = useMutation({ mutationFn: api.createStudent, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: api.deleteStudent, onSuccess: invalidate });
  const importCsv = useMutation({ mutationFn: api.importRosterCsv, onSuccess: invalidate });
  return { create, remove, importCsv };
}

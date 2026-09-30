import { Modal } from '@carbon/react';
import { modalTaskPolicy } from '../ui/task-contracts.js';

export default function TaskModal({ taskId, ...props }) {
  const policy = modalTaskPolicy(taskId);
  if (policy.status === 'unregistered') {
    throw new Error(`Modal task is not registered: ${policy.id || '(missing taskId)'}`);
  }
  return <Modal {...props} />;
}

// app/components/tasks/CreateTaskModal.tsx
// Reusable modal wrapping AddTaskForm. Props-only; no hooks.

import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { AddTaskForm } from './AddTaskForm';

export type CreateTaskModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
};

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const handleSubmit = (title: string) => {
    onSubmit(title);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.content}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={styles.title}>New task</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <AddTaskForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            clearOnSubmit
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  close: {
    fontSize: 20,
    color: '#666',
  },
});

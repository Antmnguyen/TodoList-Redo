// app/components/categories/AddCategoryModal.tsx
// =============================================================================
// ADD / EDIT CATEGORY MODAL
// =============================================================================
//
// Used for both creating and editing categories.
//
// Create mode: pass no `initialCategory` → shows "Add Category" title
// Edit mode:   pass `initialCategory` → pre-fills name and selected color
//
// Props:
//   - visible: whether modal is shown
//   - initialCategory: Category to edit (null = create mode)
//   - onSave(name, color): called when user taps Save
//   - onCancel: called when user taps Cancel
//
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Category } from '../../features/categories';

// =============================================================================
// CONSTANTS
// =============================================================================

const PRESET_COLORS = [
  '#FF3B30', // Red
  '#FF9500', // Orange
  '#FFCC00', // Yellow
  '#34C759', // Green
  '#00C7BE', // Teal
  '#007AFF', // Blue
  '#5856D6', // Purple
  '#AF52DE', // Magenta
  '#FF2D55', // Pink
  '#8E8E93', // Grey
];

// =============================================================================
// TYPES
// =============================================================================

export interface AddCategoryModalProps {
  visible: boolean;
  initialCategory?: Category | null;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  visible,
  initialCategory = null,
  onSave,
  onCancel,
}) => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[5]); // Default blue
  const [error, setError] = useState('');

  // Sync state when modal opens or category changes
  useEffect(() => {
    if (visible) {
      setName(initialCategory?.name ?? '');
      setSelectedColor(initialCategory?.color ?? PRESET_COLORS[5]);
      setError('');
    }
  }, [visible, initialCategory]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name cannot be empty');
      return;
    }
    onSave(trimmed, selectedColor);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isEditMode = initialCategory !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          {/* Title */}
          <Text style={styles.title}>
            {isEditMode ? 'Edit Category' : 'Add Category'}
          </Text>

          {/* Name input */}
          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError('');
            }}
            placeholder="e.g. Fitness, Finance..."
            placeholderTextColor="#aaa"
            autoFocus
            maxLength={30}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Color picker */}
          <Text style={styles.label}>COLOR</Text>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorSwatchSelected,
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <View style={[styles.previewDot, { backgroundColor: selectedColor }]} />
            <Text style={styles.previewText}>{name || 'Category Name'}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: selectedColor }]}
              onPress={handleSave}
            >
              <Text style={styles.saveText}>
                {isEditMode ? 'Save Changes' : 'Add Category'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: -10,
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  previewDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  previewText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

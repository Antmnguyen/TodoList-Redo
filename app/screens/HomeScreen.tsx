// app/screens/HomeScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTasks } from '../core/hooks/useTasks';
import { TaskItem } from '../components/tasks/Taskitem';
import { Task } from '../core/types/task';

export const HomeScreen: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [creatingPermanent, setCreatingPermanent] = useState(false);

  // PERMANENT TASK EXTRA STATE (quick & dirty)
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');

  const { tasks, loading, addTask, toggleTask, removeTask } = useTasks();

  const handleAddTask = async () => {
    if (!inputText.trim()) return;

    const kind: Task['kind'] = creatingPermanent ? 'permanent' : 'one_off';

    let additionalData: Partial<Task> | undefined = undefined;

    if (creatingPermanent) {
      additionalData = {
        templateTitle: inputText.trim(),
        autoRepeat: {
          interval,
          ...(interval === 'weekly' && { dayOfWeek: Number(dayOfWeek) }),
          ...(interval === 'monthly' && { dayOfMonth: Number(dayOfMonth) }),
        },
      } as any;
    }

    await addTask(inputText.trim(), kind, additionalData);

    setInputText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>
          {tasks.filter(t => !t.completed).length} active
        </Text>
      </View>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={
            creatingPermanent
              ? 'Add a permanent task template...'
              : 'Add a new task...'
          }
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleAddTask}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[
            styles.permanentToggle,
            creatingPermanent && styles.permanentToggleActive,
          ]}
          onPress={() => setCreatingPermanent(prev => !prev)}
        >
          <Text style={styles.permanentToggleText}>P</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* QUICK PERMANENT OPTIONS */}
      {creatingPermanent && (
        <View style={styles.permanentOptions}>
          <Text>Repeat:</Text>

          <View style={styles.row}>
            {(['daily', 'weekly', 'monthly'] as const).map(i => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.intervalButton,
                  interval === i && styles.intervalActive,
                ]}
                onPress={() => setInterval(i)}
              >
                <Text style={styles.intervalText}>{i}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {interval === 'weekly' && (
            <TextInput
              style={styles.smallInput}
              placeholder="Day of week (0–6)"
              keyboardType="numeric"
              value={dayOfWeek}
              onChangeText={setDayOfWeek}
            />
          )}

          {interval === 'monthly' && (
            <TextInput
              style={styles.smallInput}
              placeholder="Day of month (1–31)"
              keyboardType="numeric"
              value={dayOfMonth}
              onChangeText={setDayOfMonth}
            />
          )}
        </View>
      )}

      {/* Task List */}
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TaskItem task={item} onToggle={toggleTask} onDelete={removeTask} />
        )}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#007AFF',
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.8 },

  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },

  addButton: {
    width: 44,
    height: 44,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addButtonText: { color: '#fff', fontSize: 28 },

  permanentToggle: {
    width: 44,
    height: 44,
    backgroundColor: '#ccc',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  permanentToggleActive: { backgroundColor: '#FF9500' },
  permanentToggleText: { color: '#fff', fontWeight: 'bold' },

  permanentOptions: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },

  row: { flexDirection: 'row', marginVertical: 8 },

  intervalButton: {
    padding: 8,
    backgroundColor: '#eee',
    marginRight: 8,
    borderRadius: 6,
  },
  intervalActive: { backgroundColor: '#007AFF' },
  intervalText: { color: '#000' },

  smallInput: {
    height: 36,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    marginTop: 6,
  },

  listContent: { padding: 16 },
});

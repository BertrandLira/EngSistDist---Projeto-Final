import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Video } from './video.entity';

@Entity('ai_question_generation_logs')
export class AiQuestionGenerationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'video_id', type: 'uuid' })
  videoId: string;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  model: string | null;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ name: 'response_raw', type: 'text' })
  responseRaw: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;
}

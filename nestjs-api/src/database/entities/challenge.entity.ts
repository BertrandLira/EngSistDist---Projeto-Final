import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Video } from './video.entity';

@Entity('challenges')
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'video_id', type: 'uuid' })
  videoId: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'jsonb', nullable: true })
  options: object | null;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  // pgvector column — managed by raw SQL; TypeORM reads it as string
  @Column({ type: 'varchar', nullable: true, select: false })
  embedding: string | null;

  @Column({ type: 'varchar', length: 16, default: 'ai' })
  source: 'ai' | 'static';

  @Column({ default: false })
  consumed: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Video, (video) => video.challenges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Challenge } from './challenge.entity';

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_name', length: 512 })
  originalName: string;

  @Column({ name: 'mime_type', length: 128, default: 'video/mp4' })
  mimeType: string;

  @Column({ name: 'relative_path', length: 1024 })
  relativePath: string;

  @Column({ type: 'text', nullable: true })
  transcript: string | null;

  @Column({ name: 'scene_description', type: 'text', nullable: true })
  sceneDescription: string | null;

  @Column({ name: 'transcript_mode', type: 'varchar', length: 16, nullable: true })
  transcriptMode: string | null;

  @Column({ name: 'transcript_generated_at', type: 'timestamptz', nullable: true })
  transcriptGeneratedAt: Date | null;

  /** JSONB no Postgres; evitar `unknown[]` com emitDecoratorMetadata (reflect → Object). */
  @Column({ name: 'transcript_generation_log', type: 'jsonb', nullable: true })
  transcriptGenerationLog: object | null;

  /** queued | processing | completed | failed */
  @Column({ name: 'transcript_job_status', type: 'varchar', length: 16, nullable: true })
  transcriptJobStatus: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Challenge, (challenge) => challenge.video)
  challenges: Challenge[];
}

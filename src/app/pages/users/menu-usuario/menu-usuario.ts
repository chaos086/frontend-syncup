import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CancionDto } from '../../../core/models/dto/cancion/cancion.dto';
import { ListaCanciones } from '../../../components/lista-canciones/lista-canciones';
import { CancionService } from '../../../core/services/canciones/cancion.service';
import { ArtistaDto } from '../../../core/models/dto/artista/artista.dto';
import { ArtistaService } from '../../../core/services/artista.service';
import { TokenService } from '../../../core/auth/services/token.services';
import { RecomendacionService } from '../../../core/services/canciones/recomendacion.service';

/**
 * Componente principal del menú de usuario.
 * Gestiona la lista de canciones, la reproducción, favoritos y radio/recomendaciones.
 */
@Component({
  selector: 'app-menu-usuario',
  standalone: true,
  imports: [CommonModule, ListaCanciones],
  templateUrl: './menu-usuario.html',
  styleUrls: ['./menu-usuario.css'],
})
export class MenuUsuario implements OnInit {
  // ----------------------------
  // Variables de canciones y artistas
  // ----------------------------

  /** Lista de canciones disponibles */
  canciones: CancionDto[] = [];

  /** Canción actualmente seleccionada */
  cancionActual: CancionDto | null = null;

  /** Artista de la canción seleccionada */
  artistaActual: ArtistaDto | null = null;

  /** Elemento HTML del reproductor de audio */
  audioPlayer!: HTMLAudioElement;

  /** Variables de control de tiempo de reproducción */
  tiempoActual: string = '0:00';
  duracionTotal: string = '0:00';
  progreso: number = 0;

  /** Índice de la canción actualmente seleccionada en la lista */
  indiceActual: number = -1;

  /** Estado de reproducción */
  reproduciendo: boolean = false;

  /** Indica si la canción actual está marcada como favorita */
  esFavorita: boolean = false;

  /** Identificador del usuario logueado */
  idUsuarioLogueado: number = 1;

  // ----------------------------
  // Variables de filtros y radio
  // ----------------------------

  reproducirRadio: boolean = false;
  tituloRadio: string = '';

  reproducirFavoritas: boolean = false;
  tituloFavoritas: string = '';

  /** Filtro activo para la lista de canciones */
  filtroActivo: 'general' | 'favoritas' | 'descubrimiento' | 'radio' = 'general';

  // ----------------------------
  // Constructor
  // ----------------------------

  /**
   * @param cancionService Servicio para la gestión de canciones
   * @param artistaService Servicio para la gestión de artistas
   * @param tokenService Servicio para obtener información del usuario
   * @param recomendacionService Servicio para radio y recomendaciones semanales
   */
  constructor(
    private cancionService: CancionService,
    private artistaService: ArtistaService,
    private tokenService: TokenService,
    private recomendacionService: RecomendacionService
  ) {}

  // ----------------------------
  // Inicialización del componente
  // ----------------------------

  /**
   * Inicializa el componente cargando la lista de canciones
   * y obteniendo el ID del usuario logueado.
   */
  ngOnInit(): void {
    this.cargarCanciones();
    this.idUsuarioLogueado = this.tokenService.getUserIdFromToken() ?? 0;
  }

  // ----------------------------
  // Gestión de canciones
  // ----------------------------

  /** Obtiene la lista de canciones generales desde el backend */
  cargarCanciones() {
    this.cancionService.obtenerCancionesGeneral().subscribe({
      next: (lista) => (this.canciones = lista),
      error: (err) => console.error('Error cargando canciones', err),
    });
  }

  /**
   * Selecciona una canción y actualiza los datos de artista y favoritos.
   * Inicializa el reproductor de audio.
   * @param cancion Canción seleccionada
   */
  onSeleccionarCancion(cancion: CancionDto) {
    this.cancionActual = cancion;
    this.indiceActual = this.canciones.indexOf(cancion);

    if (cancion.idArtista) {
      this.artistaService.obtenerArtistaPorId(cancion.idArtista).subscribe({
        next: (resp) => (this.artistaActual = resp.mensaje),
        error: () => (this.artistaActual = null),
      });
    }

    this.cancionService.listarFavoritasUsuario(this.idUsuarioLogueado).subscribe({
      next: (favoritas) => (this.esFavorita = favoritas.some((fav) => fav.id === cancion.id)),
      error: () => (this.esFavorita = false),
    });

    setTimeout(() => {
      this.audioPlayer = document.getElementById('player-audio') as HTMLAudioElement;
      this.audioPlayer.ontimeupdate = () => this.actualizarProgreso();
      this.audioPlayer.onloadedmetadata = () => this.duracionMetadata();
      this.audioPlayer.play();
      this.reproduciendo = true;
    }, 0);
  }

  // ----------------------------
  // Gestión de favoritos
  // ----------------------------

  /** Agrega o quita la canción actual de la lista de favoritos del usuario */
  toggleFavorito() {
    if (!this.cancionActual) return;

    if (this.esFavorita) {
      this.cancionService.quitarFavorita(this.idUsuarioLogueado, this.cancionActual.id!).subscribe({
        next: () => (this.esFavorita = false),
        error: (err) => console.error('Error quitando favorito', err),
      });
    } else {
      this.cancionService
        .agregarFavorita(this.idUsuarioLogueado, this.cancionActual.id!)
        .subscribe({
          next: () => (this.esFavorita = true),
          error: (err) => console.error('Error agregando favorito', err),
        });
    }
  }

  // ----------------------------
  // Reproducción
  // ----------------------------

  /** Pausa o reproduce la canción actual */
  togglePlay() {
    if (!this.audioPlayer) return;

    if (this.reproduciendo) {
      this.audioPlayer.pause();
      this.reproduciendo = false;
    } else {
      this.audioPlayer.play();
      this.reproduciendo = true;
    }
  }

  /** Actualiza el progreso y el tiempo actual de reproducción */
  actualizarProgreso() {
    if (!this.audioPlayer) return;

    const actual = this.audioPlayer.currentTime;
    const total = this.audioPlayer.duration;

    this.progreso = (actual / total) * 100;
    this.tiempoActual = this.formatoTiempo(actual);
  }

  /** Establece la duración total cuando los metadatos del audio se cargan */
  duracionMetadata() {
    if (!this.audioPlayer) return;
    this.duracionTotal = this.formatoTiempo(this.audioPlayer.duration);
  }

  /**
   * Cambia el tiempo de reproducción al mover el slider
   * @param event Evento del input range
   */
  cambiarTiempo(event: any) {
    const porcentaje = event.target.value;
    const nuevoTiempo = (porcentaje / 100) * this.audioPlayer.duration;
    this.audioPlayer.currentTime = nuevoTiempo;
  }

  /** Reproduce la siguiente canción en la lista */
  siguienteCancion() {
    if (!this.canciones || this.canciones.length === 0) return;

    if (this.indiceActual >= this.canciones.length - 1) {
      this.onSeleccionarCancion(this.canciones[0]);
    } else {
      this.onSeleccionarCancion(this.canciones[this.indiceActual + 1]);
    }
  }

  /** Reproduce la canción anterior en la lista */
  anteriorCancion() {
    if (!this.canciones || this.canciones.length === 0) return;

    if (this.indiceActual <= 0) {
      this.onSeleccionarCancion(this.canciones[this.canciones.length - 1]);
    } else {
      this.onSeleccionarCancion(this.canciones[this.indiceActual - 1]);
    }
  }

  /**
   * Formatea segundos a formato mm:ss
   * @param segundos Número de segundos
   * @returns String en formato mm:ss
   */
  formatoTiempo(segundos: number): string {
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60)
      .toString()
      .padStart(2, '0');
    return `${min}:${sec}`;
  }

  /**
   * Cambia el volumen del reproductor
   * @param event Evento del input range
   */
  cambiarVolumen(event: any) {
    const volumen = Number(event.target.value);
    if (this.audioPlayer) {
      this.audioPlayer.volume = volumen;
    }
  }

  // ----------------------------
  // Radio y recomendaciones
  // ----------------------------

obtenerTituloRadio(): string {
  switch (this.filtroActivo) {
    case 'radio':
      return this.tituloRadio || 'Radio';
    case 'descubrimiento':
      return this.tituloRadio || 'Descubrimiento Semanal';
    case 'favoritas':
      return 'Tus Favoritas';
    case 'general':
      return 'Canciones Generales';
    default:
      return '';
  }
}

  /** Inicia la radio basada en la canción actual */
  iniciarRadio() {
    if (!this.cancionActual) return;

    const cancionBase = this.cancionActual;
    const idCancion = cancionBase.id!;

    this.recomendacionService.iniciarRadio(idCancion).subscribe({
      next: (radioDto) => {
        if (radioDto && radioDto.colaReproduccion?.length) {
          this.canciones = radioDto.colaReproduccion;
          this.indiceActual = 0;
          this.onSeleccionarCancion(this.canciones[0]);

          this.reproducirRadio = true;
          this.tituloRadio = `Radio ${cancionBase.titulo}`;
          this.filtroActivo = 'radio';
        }
      },
      error: (err) => console.error('Error iniciando radio', err),
    });
  }

  /** Muestra la lista general de canciones y oculta radio o filtros activos */
  mostrarCancionesGenerales() {
    this.reproducirRadio = false;
    this.filtroActivo = 'general';
    this.cargarCanciones();
    this.cancionActual = null;
  }

  /** Muestra las canciones favoritas del usuario */
  mostrarFavoritas() {
    if (!this.idUsuarioLogueado) return;

    this.reproducirRadio = false;
    this.filtroActivo = 'favoritas';

    this.cancionService.listarFavoritasUsuario(this.idUsuarioLogueado).subscribe({
      next: (favoritas) => {
        this.canciones = favoritas;
        this.cancionActual = null;
        this.indiceActual = -1;
      },
      error: (err) => console.error('Error cargando favoritas', err),
    });
  }

  /** Muestra las canciones del descubrimiento semanal del usuario */
  mostrarDescubrimiento() {
    if (!this.idUsuarioLogueado) return;

    this.reproducirRadio = false;
    this.filtroActivo = 'descubrimiento';
    this.tituloRadio = 'Descubrimiento semanal';

    this.recomendacionService.generarDescubrimientoSemanal(this.idUsuarioLogueado).subscribe({
      next: (playListDto) => {
        if (playListDto && playListDto.canciones?.length) {
          this.canciones = playListDto.canciones;
          this.cancionActual = null;
          this.indiceActual = -1;
        } else {
          this.canciones = [];
        }
      },
      error: (err) => console.error('Error cargando descubrimiento semanal', err),
    });
  }
  
}

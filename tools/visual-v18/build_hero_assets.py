"""Create REF-D-inspired production meshes, editable .blend sources and glTF.
Run: blender --background --python tools/visual-v18/build_hero_assets.py -- bed|sofa
"""
import os,sys,math
sys.path.insert(0,os.path.dirname(__file__))
from model_common import *

def bed():
    clear()
    wood=material('Smoked walnut',(.075,.037,.019),.38,texture='wood')
    bronze=material('Satin champagne bronze',(.29,.19,.085),.3,.78)
    fabric=material('Warm grey woven headboard',(.32,.29,.255),.92,texture='fabric')
    linen=material('Warm ivory linen',(.58,.53,.46),.95,texture='fabric')
    duvet=material('Graphite taupe quilted cover',(.23,.205,.19),.96,texture='fabric')
    charcoal=material('Charcoal textured bed runner',(.075,.069,.064),.95,texture='fabric')
    cover_thread=material('Muted quilt seam',(.19,.17,.16),.97)
    seam=material('Warm seam thread',(.25,.23,.20),.9)
    glow=material('Opal bedside globe',(.96,.68,.32),.3,emission=2.8)
    # Solid joinery plus recessed brass feet; headboard uses individually padded channels.
    box('Walnut platform',(0,.23,0),(2.2,.26,2.52),wood,.055,6)
    box('Recessed upholstered plinth',(0,.13,0),(1.94,.18,2.3),fabric,.04)
    for x in [-.91,.91]:
        for z in [-1.05,1.05]:cyl('Recessed bronze foot',(x,.075,z),.045,.15,bronze)
    box('Headboard structural backing',(0,.68,-1.22),(2.23,1.12,.11),wood,.04)
    for i in range(5):
        x=(i-2)*.428
        box('Vertical tailored headboard panel '+str(i),(x,.88,-1.145),(.416,.70,.14),fabric,.04,8)
        # inset sewn channel on the upper upholstery border
        tube('Headboard piping '+str(i),[(x-.18,.57,-1.067),(x-.18,1.18,-1.067),(x+.18,1.18,-1.067),(x+.18,.57,-1.067)],.0025,seam)
    soft('Quilted mattress',(0,.505,0),(2.06,.30,2.34),linen,.10,.003)
    tube('Mattress perimeter seam',rounded_rect(0,.59,0,2.04,2.32,.10),.005,seam,True)
    tube('Mattress lower piping',rounded_rect(0,.40,0,2.04,2.32,.10),.004,seam,True)
    # The duvet is a draped gridded mesh, not a box; hanging sides and foot retain folds.
    cloth('Graphite cover with sculpted cross folds',(0,.20),2.43,1.99,.77,duvet,.27,.018)
    cloth('Folded linen top edge',(0,-.66),2.40,.22,.82,linen,.16,.008,1)
    cloth('Dark folded knitted runner',(0,.79),2.46,.56,.84,charcoal,.30,.017,3)
    # Shallow sewn channels follow the actual draped mesh profile. These remain
    # visible in the game close-up without looking like painted stripes.
    for row,z in enumerate([-.28,.04,.36]):
        pts=[]
        v=(z-.20)/1.99+.5
        for i in range(90):
            u=i/89; x=(u-.5)*2.43
            side=max(0,(abs(u-.5)-.405)/.095)
            foot=max(0,(v-.86)/.14)
            y=.77-.27*side**.55-.27*.75*foot**.65
            y+=.018*(math.sin(u*26+v*7)+.38*math.sin(u*53-v*5)+.18*math.cos(v*31+u*9))
            y+=.018*1.7*math.sin(v*math.pi)**2*math.sin(u*7)
            pts.append((x,y+.004,z))
        tube('Cover tailored cross seam '+str(row),pts,.0018,cover_thread)
    # Hem stitches along the foot edge, following the cloth contour.
    for row,z in enumerate([.91,1.04]):
        pts=[]
        for i in range(90):
            u=i/89; x=(u-.5)*2.46; side=max(0,(abs(u-.5)-.405)/.095)
            v=(z-.79)/.56+.5; foot=max(0,(v-.86)/.14)
            y=.843-.30*side**.55-.30*.75*foot**.65
            y+=.017*(math.sin(u*26+v*7+3)+.38*math.sin(u*53-v*5)+.18*math.cos(v*31+u*9))
            y+=.017*1.7*math.sin(v*math.pi)**2*math.sin(u*7+3)
            pts.append((x,y,z))
        tube('Runner woven hem '+str(row),pts,.0032,seam)
    # Two big plumped pillows plus dark and stone accent cushions.
    def tailored_pillow(name,cx,cz):
        # A closed, inflated textile surface tapers to a piped edge. The broad
        # rectangular face and back-to-front slope read as a pillow, not a tube.
        nx,nz=24,20; verts=[]; uv=[]; faces=[]
        for layer in (1,-1):
            for j in range(nz+1):
                v=2*j/nz-1
                for i in range(nx+1):
                    u=2*i/nx-1
                    swell=max(0,(1-abs(u)**6)*(1-abs(v)**6))**.5
                    x=cx+u*.39*(1-.075*abs(v)**8)
                    z=cz+v*.285*(1-.075*abs(u)**8)
                    y=.86-.065*v+( .105*swell+.015*swell*swell if layer==1 else -.07*swell)
                    verts.append(xyz((x,y,z))); uv.append((i/nx,j/nz))
        stride=nx+1; layer_stride=stride*(nz+1)
        for j in range(nz):
            for i in range(nx):
                a=j*stride+i
                faces.append((a,a+stride,a+stride+1,a+1))
                b=layer_stride+a
                faces.append((b,b+1,b+stride+1,b+stride))
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
        obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); apply_material(obj,linen)
        layer=mesh.uv_layers.new(name='Woven pillow UV')
        for poly in mesh.polygons:
            for li in poly.loop_indices: layer.data[li].uv=uv[mesh.loops[li].vertex_index]
        piping=[]
        for u,v in [(-1+2*i/32,-1) for i in range(33)]+[(1,-1+2*i/24) for i in range(1,25)]+[(1-2*i/32,1) for i in range(1,33)]+[(-1,1-2*i/24) for i in range(1,24)]:
            piping.append((cx+u*.39*(1-.075*abs(v)**8),.86-.065*v,cz+v*.285*(1-.075*abs(u)**8)))
        tube(name+' edge piping',piping,.0022,seam,True)
    for i,x in enumerate([-.42,.42]):
        tailored_pillow('Large linen pillow '+str(i),x,-.80)
    for i,(x,z) in enumerate([(-.26,-.55),(.30,-.56)]):
        p=soft('Decorative cushion '+str(i),(x,.94,z),(.51,.18,.39),charcoal if i==0 else duvet,.055,.005,(-.13 if i==0 else .12)); p.rotation_euler[0]=-.65
    # Integrated bedside joinery, drawer reveals, metal handles and globe lamps.
    for sign in [-1,1]:
        x=sign*1.43
        box('Floating bedside walnut cabinet',(x,.36,-.85),(.54,.43,.51),wood,.018)
        box('Bedside stone top',(x,.59,-.85),(.56,.028,.53),bronze,.012)
        for y in [.28,.47]:
            box('Bedside drawer front',(x,y,-.581),(.50,.17,.022),wood,.006)
            tube('Drawer bronze pull',[(x-.06,y+.035,-.561),(x+.06,y+.035,-.561)],.007,bronze)
        for dx in [-.19,.19]:
            for dz in [-.18,.18]:cyl('Bedside slender foot',(x+dx,.075,-.85+dz),.013,.15,bronze,24)
        cyl('Lamp base',(x,.63,-.87),.11,.035,bronze)
        cyl('Lamp stem',(x,.69,-.87),.023,.09,bronze)
        sphere('Opaline luminous globe',(x,.825,-.87),(.125,.125,.125),glow)
        for j in range(2):box('Bedside stacked book',(x+.1,.625+j*.025,-.67),(.17,.024,.12),linen if j else charcoal,.003)
    out=export_asset('bed','premium-bed','Premium low walnut platform bed with padded channel headboard, layered linen, graphite sculpted cover and dark runner; two nightstands with opal globe lamps.', ['Beveled joinery','Subdivided deformed cushions','80 by 66 draped cloth meshes','Tailored piping and cross seams','5 padded headboard channels','2 PBR fabric textures with normal maps','Walnut base color and normal map','Bedside drawers and lamps'])
    preview(out,(4.2,3.6,5),(0,.65,0),4.7)

def sofa():
    clear()
    fabric=material('Oyster taupe sofa weave',(.34,.315,.28),.94,texture='fabric')
    lighter=material('Sand cushion weave',(.46,.405,.33),.96,texture='fabric')
    dark=material('Charcoal accent weave',(.055,.052,.047),.96,texture='fabric')
    seam=material('Upholstery stitched welt',(.19,.175,.15),.9)
    wood=material('Sofa walnut underside',(.055,.028,.018),.4,texture='wood')
    bronze=material('Blackened bronze legs',(.085,.064,.04),.3,.8)
    # L-shaped joinery and continuous upholstered apron. Chaise at local left/front.
    box('Long walnut chassis',(.0,.21,-.28),(3.12,.16,1.02),wood,.045)
    box('Chaise walnut chassis',(-1.03,.21,.56),(1.06,.16,1.78),wood,.045)
    soft('Long upholstered apron',(0,.34,-.25),(3.16,.28,1.07),fabric,.09,.003)
    soft('Chaise upholstered apron',(-1.03,.34,.59),(1.08,.28,1.81),fabric,.09,.003)
    for x,z in [(-1.39,-.65),(1.39,-.65),(1.39,.13),(-.65,1.29),(-1.39,1.29),(-.47,.13)]:
        cyl('Recessed tapered bronze foot',(x,.10,z),.033,.20,bronze,32)
    # Bolstered frame and separate cushion construction.
    soft('Long upholstered back',(0,.79,-.70),(3.15,.86,.25),fabric,.09,.005)
    for x in [-1.48,1.48]:soft('Rounded upholstered arm',(x,.66,-.19),(.25,.62,1.14),fabric,.095,.005)
    for i,x in enumerate([-.91,0,.91]):
        soft('Seat cushion '+str(i),(x,.565,-.18),(.87,.24,.90),fabric,.105,.008)
        tube('Seat cushion upper welt '+str(i),rounded_rect(x,.658,-.18,.84,.87,.09),.004,seam,True)
        p=soft('Back pillow '+str(i),(x,.94,-.50),(.88,.61,.23),fabric,.10,.009)
        p.rotation_euler[0]=-.10
        tube('Back cushion top seam '+str(i),[(x-.36,1.205,-.355),(x-.18,1.22,-.354),(x+.18,1.22,-.354),(x+.36,1.205,-.355)],.004,seam)
    soft('Extended chaise cushion',(-1.03,.56,.78),(1.02,.25,1.29),fabric,.11,.012)
    tube('Chaise perimeter welt',rounded_rect(-1.03,.655,.78,.99,1.26,.10),.004,seam,True)
    # Tufted dimples physically press the chaise upholstery rather than painted dots.
    for x,z in [(-1.24,.54),(-.84,.54),(-1.24,1.03),(-.84,1.03)]:
        sphere('Recessed tuft button',(x,.681,z),(.025,.007,.025),seam)
    for i,(x,z) in enumerate([(-1.03,-.17),(1.06,-.25)]):
        p=soft('Decorative throw cushion '+str(i),(x,.93,z),(.56,.56,.19),lighter if i==0 else dark,.095,.012)
        p.rotation_euler[0]=-.23; p.rotation_euler[1]=-.14 if i==0 else .17
    cloth('Casually draped charcoal throw',(-1.02,.55),1.32,.91,.760,dark,.22,.018,4)
    # Fine stitched hem and twisted tassels at the blanket foot.
    for i in range(17):
        x=-1.49+i*.057
        tube('Throw fringe '+str(i),[(x,.53,1.015),(x+.008,.48,1.045),(x-.006,.43,1.06)],.0035,dark)
    out=export_asset('sofa','sectional-sofa','Tailored taupe L-shaped sectional with individual soft seat/back cushions, rounded arm bolsters, bronze feet, piped seams, accent pillows and sculpted charcoal throw.', ['Subdivided deformed upholstery','Individual seat and back cushions','Chaise silhouette','Continuous stitched welt geometry','Tailored draped throw with fringes','Recessed bronze feet','Embedded fabric base color/normal maps'])
    preview(out,(4,3.2,5),(0,.6,.25),4.6)

if __name__=='__main__':
    arg=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'bed'
    {'bed':bed,'sofa':sofa}[arg]()
